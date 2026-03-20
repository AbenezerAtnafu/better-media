import type { MongoClient, Db, Collection, Document, Filter, ClientSession } from "mongodb";
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
import type { FieldType, BmSchema, DbHooks } from "better-media";
import { serializeData, deserializeData, runHooks } from "better-media";
import type { MongoDbConfig } from "./mongodb-db-config.interface";

export interface MongoDbOptions {
  config: MongoDbConfig;
  schema: BmSchema;
  hooks?: DbHooks;
  session?: ClientSession;
}

/**
 * MongoDB database adapter.
 * Uses a collection-per-table structure.
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

  /**
   * Translates our generic WhereClause to a MongoDB filter.
   */
  private buildFilter(where?: WhereClause): Filter<Document> {
    if (!where || where.length === 0) return {};

    const filter: Record<string, unknown> = {};

    for (const condition of where) {
      // In MongoDB, we usually map 'id' to '_id'
      const field = condition.field === "id" ? "_id" : condition.field;
      const value = condition.value;

      switch (condition.operator) {
        case "!=":
          filter[field] = { $ne: value };
          break;
        case "<":
          filter[field] = { $lt: value };
          break;
        case "<=":
          filter[field] = { $lte: value };
          break;
        case ">":
          filter[field] = { $gt: value };
          break;
        case ">=":
          filter[field] = { $gte: value };
          break;
        case "in":
          filter[field] = { $in: value as unknown[] };
          break;
        case "not_in":
          filter[field] = { $nin: value as unknown[] };
          break;
        case "starts_with":
          filter[field] = { $regex: new RegExp(`^${String(value)}`, "i") };
          break;
        case "ends_with":
          filter[field] = { $regex: new RegExp(`${String(value)}$`, "i") };
          break;
        case "contains":
        case "like":
          // Case-insensitive regex search
          filter[field] = { $regex: new RegExp(String(value), "i") };
          break;
        case "=":
        default:
          filter[field] = value;
          break;
      }
    }

    return filter as Filter<Document>;
  }

  /** Converts incoming data 'id' -> '_id' for mongo */
  private mapToMongo(data: Record<string, unknown>): Document {
    const { id, ...rest } = data;
    if (id !== undefined) {
      return { _id: id, ...rest } as Document;
    }
    return rest as Document;
  }

  /** Converts outgoing data '_id' -> 'id' from mongo */
  private mapFromMongo(doc: Document | null): Record<string, unknown> | null {
    if (!doc) return null;
    const { _id, ...rest } = doc as { _id: unknown } & Record<string, unknown>;
    return { id: typeof _id === "string" ? _id : String(_id), ...rest };
  }

  async create<T extends Record<string, unknown>>(options: CreateOptions<T>): Promise<T> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);

    let dataToInsert = options.data as Record<string, unknown>;
    dataToInsert = await runHooks.beforeCreate(this.hooks, options.model, dataToInsert);

    const serializedData = serializeData(fields, dataToInsert);
    const mongoDoc = this.mapToMongo(serializedData);

    await collection.insertOne(mongoDoc, { session: this.session });

    const resultRecord = deserializeData(fields, this.mapFromMongo(mongoDoc)!) as T;

    await runHooks.afterCreate(this.hooks, options.model, resultRecord as Record<string, unknown>);
    return resultRecord;
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);

    const filter = this.buildFilter(options.where);

    // Convert to avoid bringing everything back if select is specified
    const projection: Record<string, 1> = {};
    if (options.select) {
      for (const field of options.select) {
        projection[field === "id" ? "_id" : field] = 1;
      }
    }

    const doc = await collection.findOne(filter, {
      projection: Object.keys(projection).length > 0 ? projection : undefined,
      session: this.session,
    });

    if (!doc) return null;

    const record = this.mapFromMongo(doc);
    return deserializeData(fields, record!) as T;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);

    const filter = this.buildFilter(options.where);

    let cursor = collection.find(filter, { session: this.session });

    if (options.select) {
      const projection: Record<string, 1> = {};
      for (const field of options.select) {
        projection[field === "id" ? "_id" : field] = 1;
      }
      cursor = cursor.project(projection);
    }

    if (options.sortBy) {
      const field = options.sortBy.field === "id" ? "_id" : options.sortBy.field;
      cursor = cursor.sort({ [field]: options.sortBy.direction === "asc" ? 1 : -1 });
    }

    if (options.offset) {
      cursor = cursor.skip(options.offset);
    }

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    const docs = await cursor.toArray();

    return docs.map((doc: Document) => deserializeData(fields, this.mapFromMongo(doc)!)) as T[];
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);

    // 1. Fetch current target
    const filter = this.buildFilter(options.where);
    const doc = await collection.findOne(filter, { session: this.session });
    if (!doc) return null;

    const currentRecord = deserializeData(fields, this.mapFromMongo(doc)!);

    // 2. Run hooks
    let updatedData = { ...currentRecord, ...(options.update as Record<string, unknown>) };
    updatedData = await runHooks.beforeUpdate(this.hooks, options.model, updatedData);

    // 3. Serialize and persist
    const serializedUpdate = serializeData(fields, options.update as Record<string, unknown>);
    const mongoUpdate = this.mapToMongo(serializedUpdate);
    // Remove _id from $set to avoid Mongo error
    delete mongoUpdate._id;

    await collection.updateOne(filter, { $set: mongoUpdate }, { session: this.session });

    const resultRecord = deserializeData(fields, serializeData(fields, updatedData)) as T;

    await runHooks.afterUpdate(this.hooks, options.model, resultRecord as Record<string, unknown>);
    return resultRecord;
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const fields = this.getModelFields(options.model);
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where);

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

    await runHooks.beforeDelete(this.hooks, options.model, options.where);

    const filter = this.buildFilter(options.where);

    // If deleting by id, usually singular. Otherwise could be many.
    if (
      options.where?.length === 1 &&
      options.where[0]?.field === "id" &&
      options.where[0]?.operator !== "!="
    ) {
      await collection.deleteOne(filter, { session: this.session });
    } else {
      await collection.deleteMany(filter, { session: this.session });
    }

    await runHooks.afterDelete(this.hooks, options.model, options.where);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where);
    const result = await collection.deleteMany(filter, { session: this.session });
    return result.deletedCount;
  }

  async count(options: CountOptions): Promise<number> {
    const collection = this.getCollection(options.model);
    const filter = this.buildFilter(options.where);
    return collection.countDocuments(filter, { session: this.session });
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

  /**
   * Internal migration method. Ensures collections exist.
   */
  async __initCollection(model: string, definition: BmSchema[string]): Promise<void> {
    // MongoDB auto-creates collections, but we can explicitly create it
    // and set up unique indexes based on schema

    const existingCollections = await this.db.listCollections({ name: model }).toArray();
    if (existingCollections.length === 0) {
      await this.db.createCollection(model);
    }

    const collection = this.getCollection(model);

    for (const [fieldName, fieldDef] of Object.entries(definition.fields)) {
      if (fieldDef?.unique && !fieldDef?.primaryKey) {
        // primaryKey 'id' -> '_id' which is already unique in Mongo
        await collection.createIndex({ [fieldName]: 1 }, { unique: true });
      }

      if (fieldDef?.references) {
        // Index foreign keys for faster joins/lookups
        await collection.createIndex({ [fieldName]: 1 });
      }
    }
  }
}
