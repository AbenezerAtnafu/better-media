import { MongoClient, Db, Collection, Document, Filter, ClientSession } from "mongodb";
import type {
  DatabaseAdapter,
  DatabaseTransactionAdapter,
  WhereClause,
  CreateOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  CountOptions,
} from "@better-media/core";
import type {
  FieldType,
  BmSchema,
  DbHooks,
  DatabaseHookContext,
  ModelDefinition,
} from "@better-media/core";
import { serializeData, deserializeData, runHooks } from "@better-media/core";
import type { MongoDbConfig } from "./mongodb-db-config.interface";

export interface MongoDbOptions {
  config: MongoDbConfig;
  schema: BmSchema;
  hooks?: DbHooks;
  session?: ClientSession;
}

/**
 * MongoDB database adapter.
 */
export class MongoDbAdapter implements DatabaseAdapter {
  private readonly client: MongoClient;
  private readonly db: Db;
  private readonly schema: BmSchema;
  private readonly hooks?: DbHooks;
  private readonly session?: ClientSession;

  constructor(client: MongoClient, options: MongoDbOptions) {
    this.client = client;
    this.db = this.client.db(options.config.databaseName);
    this.schema = options.schema;
    this.hooks = options.hooks;
    this.session = options.session;
  }

  private getCollection(model: string): Collection<Document> {
    return this.db.collection(model);
  }

  private getModelFields(model: string): Record<string, { type: FieldType }> {
    return this.schema[model]?.fields ?? {};
  }

  private getModelDefinition(model: string): ModelDefinition | undefined {
    return this.schema[model];
  }

  private getHookContext(model: string, trx?: DatabaseTransactionAdapter): DatabaseHookContext {
    return {
      model,
      adapter: this,
      transaction: trx,
    };
  }

  private buildFilter(
    where?: WhereClause,
    model?: string,
    options?: { withDeleted?: boolean }
  ): Filter<Document> {
    let filter: Filter<Document> = {};
    const definition = model ? this.getModelDefinition(model) : undefined;

    // Soft delete filtering
    if (definition?.softDelete && !options?.withDeleted) {
      filter = { deletedAt: null };
    }

    if (!where || where.length === 0) return filter;

    let whereFilter: Filter<Document> = {};

    for (let i = 0; i < where.length; i++) {
      const condition = where[i]!;
      const connector = i > 0 ? (where[i - 1]?.connector ?? "AND") : "AND";
      const field = condition.field === "id" ? "_id" : condition.field;
      const value = condition.value;
      const conditionFilter: Record<string, unknown> = {};

      switch (condition.operator) {
        case "!=":
          conditionFilter[field] = { $ne: value };
          break;
        case "<":
          conditionFilter[field] = { $lt: value };
          break;
        case "<=":
          conditionFilter[field] = { $lte: value };
          break;
        case ">":
          conditionFilter[field] = { $gt: value };
          break;
        case ">=":
          conditionFilter[field] = { $gte: value };
          break;
        case "in":
          conditionFilter[field] = { $in: value as unknown[] };
          break;
        case "not_in":
          conditionFilter[field] = { $nin: value as unknown[] };
          break;
        case "starts_with":
          conditionFilter[field] = {
            $regex: new RegExp(`^${this.escapeRegex(String(value))}`, "i"),
          };
          break;
        case "ends_with":
          conditionFilter[field] = {
            $regex: new RegExp(`${this.escapeRegex(String(value))}$`, "i"),
          };
          break;
        case "contains":
        case "like":
          conditionFilter[field] = { $regex: new RegExp(this.escapeRegex(String(value)), "i") };
          break;
        case "=":
        default:
          conditionFilter[field] = value;
          break;
      }

      if (i === 0) {
        whereFilter = conditionFilter;
      } else if (connector === "OR") {
        whereFilter = {
          $or: [whereFilter as Record<string, unknown>, conditionFilter],
        } as Filter<Document>;
      } else {
        whereFilter = {
          $and: [whereFilter as Record<string, unknown>, conditionFilter],
        } as Filter<Document>;
      }
    }

    // Combine with soft delete filter
    if (Object.keys(filter).length > 0 && Object.keys(whereFilter).length > 0) {
      return { $and: [filter, whereFilter] } as Filter<Document>;
    }
    return Object.keys(whereFilter).length > 0 ? whereFilter : filter;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private mapToMongo(data: Record<string, unknown>): Document {
    const { id, ...rest } = data;
    return id !== undefined ? { _id: id, ...rest } : (rest as Document);
  }

  private mapFromMongo(doc: Document | null): Record<string, unknown> | null {
    if (!doc) return null;
    const { _id, ...rest } = doc as { _id: unknown } & Record<string, unknown>;
    return { id: typeof _id === "string" ? _id : String(_id), ...rest };
  }

  async create<T extends Record<string, unknown>>(options: CreateOptions<T>): Promise<T> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);
    const context = this.getHookContext(options.model);

    let dataToInsert = options.data as Record<string, unknown>;
    dataToInsert = await runHooks.beforeCreate(this.hooks, dataToInsert, context);

    const serializedData = serializeData(fields, dataToInsert);
    const mongoDoc = this.mapToMongo(serializedData);

    await collection.insertOne(mongoDoc, { session: this.session });
    const resultRecord = deserializeData(fields, this.mapFromMongo(mongoDoc)!) as T;

    await runHooks.afterCreate(this.hooks, resultRecord as Record<string, unknown>, context);
    return resultRecord;
  }

  private async applyPopulate(
    model: string,
    pipeline: Record<string, unknown>[],
    populate: string[]
  ): Promise<void> {
    const sortedPopulate = [...populate].sort((a, b) => a.split(".").length - b.split(".").length);

    for (const path of sortedPopulate) {
      const parts = path.split(".");
      let currentModel = model;
      let currentPath = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const fieldDef = this.schema[currentModel]?.fields[part];

        if (fieldDef?.references) {
          const localField = currentPath ? `${currentPath}.${part}` : part;
          const asField = localField;

          pipeline.push({
            $lookup: {
              from: fieldDef.references.model,
              localField: localField,
              foreignField: fieldDef.references.field === "id" ? "_id" : fieldDef.references.field,
              as: asField,
            },
          });
          pipeline.push({ $unwind: { path: `$${asField}`, preserveNullAndEmptyArrays: true } });

          currentModel = fieldDef.references.model;
          currentPath = asField;
        } else {
          // If a part doesn't have references, we can't populate further deep from here
          break;
        }
      }
    }
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where, options.model, {
      withDeleted: options.withDeleted,
    });

    if (options.populate && options.populate.length > 0) {
      const pipeline: Record<string, unknown>[] = [{ $match: filter }];
      await this.applyPopulate(options.model, pipeline, options.populate);

      const results = await (
        collection as unknown as {
          aggregate: (p: unknown[], o: unknown) => { toArray: () => Promise<Document[]> };
        }
      )
        .aggregate(pipeline, { session: this.session })
        .toArray();
      const doc = results[0];
      if (!doc) return null;
      return deserializeData(fields, this.mapFromMongo(doc)!) as T;
    }

    const projection: Record<string, 1> = {};
    if (options.select) {
      for (const field of options.select) projection[field === "id" ? "_id" : field] = 1;
    }

    const doc = await collection.findOne(filter, {
      projection: Object.keys(projection).length > 0 ? projection : undefined,
      session: this.session,
    });

    if (!doc) return null;
    return deserializeData(fields, this.mapFromMongo(doc)!) as T;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where, options.model, {
      withDeleted: options.withDeleted,
    });

    if (options.populate && options.populate.length > 0) {
      // Aggregate population
      const pipeline: Record<string, unknown>[] = [{ $match: filter }];
      await this.applyPopulate(options.model, pipeline, options.populate);

      if (options.sortBy) {
        const field = options.sortBy.field === "id" ? "_id" : options.sortBy.field;
        pipeline.push({ $sort: { [field]: options.sortBy.direction === "asc" ? 1 : -1 } });
      }
      if (options.offset) pipeline.push({ $skip: options.offset });
      if (options.limit) pipeline.push({ $limit: options.limit });

      const docs = await (
        collection as unknown as {
          aggregate: (p: unknown[], o: unknown) => { toArray: () => Promise<Document[]> };
        }
      )
        .aggregate(pipeline, { session: this.session })
        .toArray();
      return docs.map((doc: Document) => deserializeData(fields, this.mapFromMongo(doc)!)) as T[];
    }

    let cursor = collection.find(filter, { session: this.session });
    if (options.select) {
      const projection: Record<string, 1> = {};
      for (const field of options.select) projection[field === "id" ? "_id" : field] = 1;
      cursor = cursor.project(projection);
    }
    if (options.sortBy) {
      const field = options.sortBy.field === "id" ? "_id" : options.sortBy.field;
      cursor = cursor.sort({ [field]: options.sortBy.direction === "asc" ? 1 : -1 });
    }
    if (options.offset) cursor = cursor.skip(options.offset);
    if (options.limit) cursor = cursor.limit(options.limit);

    const docs = await cursor.toArray();
    return docs.map((doc: Document) => deserializeData(fields, this.mapFromMongo(doc)!)) as T[];
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);
    const context = this.getHookContext(options.model);

    const filter = this.buildFilter(options.where, options.model);
    const doc = await collection.findOne(filter, { session: this.session });
    if (!doc) return null;

    const currentRecord = deserializeData(fields, this.mapFromMongo(doc)!);
    let updatedData = { ...currentRecord, ...(options.update as Record<string, unknown>) };
    updatedData = await runHooks.beforeUpdate(this.hooks, updatedData, context);

    const serializedUpdate = serializeData(fields, options.update as Record<string, unknown>);
    const mongoUpdate = this.mapToMongo(serializedUpdate);
    delete mongoUpdate._id;

    await collection.updateOne(filter, { $set: mongoUpdate }, { session: this.session });
    const resultRecord = deserializeData(fields, serializeData(fields, updatedData)) as T;

    await runHooks.afterUpdate(this.hooks, resultRecord as Record<string, unknown>, context);
    return resultRecord;
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where, options.model);

    const serializedUpdate = serializeData(fields, options.update as Record<string, unknown>);
    const mongoUpdate = this.mapToMongo(serializedUpdate);
    delete mongoUpdate._id;

    const result = await collection.updateMany(
      filter,
      { $set: mongoUpdate },
      { session: this.session }
    );
    return result.modifiedCount;
  }

  async delete(options: DeleteOptions): Promise<void> {
    const collection = this.getCollection(options.model);
    const context = this.getHookContext(options.model);
    const definition = this.getModelDefinition(options.model);

    await runHooks.beforeDelete(this.hooks, options.where, context);

    const filter = this.buildFilter(options.where, options.model);

    if (definition?.softDelete) {
      await this.updateMany({
        model: options.model,
        where: options.where,
        update: { deletedAt: new Date() } as unknown as Record<string, unknown>,
      });
    } else {
      if (
        options.where?.length === 1 &&
        options.where[0]?.field === "id" &&
        options.where[0]?.operator !== "!="
      ) {
        await collection.deleteOne(filter, { session: this.session });
      } else {
        await collection.deleteMany(filter, { session: this.session });
      }
    }

    await runHooks.afterDelete(this.hooks, options.where, context);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where, options.model);
    const definition = this.getModelDefinition(options.model);

    if (definition?.softDelete) {
      return await this.updateMany({
        model: options.model,
        where: options.where,
        update: { deletedAt: new Date() } as unknown as Record<string, unknown>,
      });
    }

    const result = await collection.deleteMany(filter, { session: this.session });
    return result.deletedCount;
  }

  async count(options: CountOptions): Promise<number> {
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where, options.model);
    return collection.countDocuments(filter, { session: this.session });
  }

  async raw<T = unknown>(query: string, _params?: unknown[]): Promise<T> {
    // For Mongo, 'raw' can mean a direct command or aggregate
    if (query.startsWith("{")) {
      return (await (this.db as unknown as { command: (c: unknown) => Promise<unknown> }).command(
        JSON.parse(query)
      )) as unknown as T;
    }
    throw new Error("MongoDB 'raw' requires a JSON command string.");
  }

  async transaction<R>(callback: (trx: DatabaseTransactionAdapter) => Promise<R>): Promise<R> {
    const session = this.client.startSession();
    try {
      return (await session.withTransaction(async () => {
        const trxAdapter = new MongoDbAdapter(this.client, {
          config: { databaseName: this.db.databaseName },
          schema: this.schema,
          hooks: this.hooks,
          session,
        });
        return await callback(trxAdapter);
      })) as R;
    } finally {
      await session.endSession();
    }
  }

  async __initCollection(
    model: string,
    definition: ModelDefinition,
    options: { mode: "safe" | "diff" | "force" }
  ): Promise<void> {
    if (options.mode === "force") {
      await (
        this.getCollection(model) as unknown as {
          drop: () => Promise<void>;
        }
      )
        .drop()
        .catch(() => {});
    }

    const collections = await this.db.listCollections({ name: model }).toArray();
    if (collections.length === 0) {
      await this.db.createCollection(model);
    }

    const collection = this.getCollection(model);
    const existingIndexes = await (
      collection as unknown as {
        listIndexes: () => { toArray: () => Promise<{ name: string }[]> };
      }
    )
      .listIndexes()
      .toArray();
    const existingIndexNames = new Set(existingIndexes.map((idx) => idx.name));

    // Fields-based indexes (implicitly unique/foreign key)
    for (const [fieldName, fieldDef] of Object.entries(definition.fields)) {
      if (fieldDef?.unique && !fieldDef?.primaryKey) {
        const indexName = `${fieldName}_1`;
        if (!existingIndexNames.has(indexName)) {
          await collection.createIndex({ [fieldName]: 1 }, { unique: true });
        }
      }
      if (fieldDef?.references) {
        const indexName = `${fieldName}_1`;
        if (!existingIndexNames.has(indexName)) {
          await collection.createIndex({ [fieldName]: 1 });
        }
      }
    }

    // Explicit indexes from definition.indexes
    if (definition.indexes) {
      for (const index of definition.indexes) {
        const indexSpec: Record<string, 1> = {};
        for (const field of index.fields) {
          indexSpec[field === "id" ? "_id" : field] = 1;
        }

        const indexName = `idx_${index.fields.join("_")}`;
        if (!existingIndexNames.has(indexName)) {
          await (
            collection as unknown as {
              createIndex: (s: unknown, o: unknown) => Promise<void>;
            }
          ).createIndex(indexSpec, {
            name: indexName,
            unique: !!index.unique,
          });
        }
      }
    }
  }
}
