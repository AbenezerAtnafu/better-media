import type { Kysely } from "kysely";
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
import type { KyselyDbConfig } from "./kysely-db-config.interface";

export interface KyselyDbOptions {
  config: KyselyDbConfig;
  schema: BmSchema;
  hooks?: DbHooks;
}

export type DbSchema = Record<string, Record<string, unknown>>;

interface SelectBuilder {
  select(s: string[]): SelectBuilder;
  selectAll(): SelectBuilder;
  where(f: string, o: string, v: unknown): SelectBuilder;
  orWhere(f: string, o: string, v: unknown): SelectBuilder;
  orderBy(f: string, d: string): SelectBuilder;
  limit(l: number): SelectBuilder;
  offset(o: number): SelectBuilder;
  execute(): Promise<Record<string, unknown>[]>;
  executeTakeFirst(): Promise<Record<string, unknown> | undefined>;
}

interface UpdateBuilder {
  set(d: Record<string, unknown>): UpdateBuilder;
  where(f: string, o: string, v: unknown): UpdateBuilder;
  orWhere(f: string, o: string, v: unknown): UpdateBuilder;
  execute(): Promise<{ numUpdatedRows: bigint }[]>;
}

interface DeleteBuilder {
  where(f: string, o: string, v: unknown): DeleteBuilder;
  orWhere(f: string, o: string, v: unknown): DeleteBuilder;
  execute(): Promise<{ numDeletedRows: bigint }[]>;
}

interface InsertValuesBuilder {
  returningAll(): { executeTakeFirst(): Promise<Record<string, unknown> | undefined> };
  execute(): Promise<void>;
}

interface InsertBuilder {
  values(d: Record<string, unknown>): InsertValuesBuilder;
}

/**
 * SQL database adapter using Kysely.
 * Supports PostgreSQL, MySQL, and SQLite.
 */
export class KyselyDbAdapter implements DatabaseAdapter {
  private readonly db: Kysely<DbSchema>;
  private readonly config: KyselyDbConfig;
  private readonly schema: BmSchema;
  private readonly hooks?: DbHooks;

  constructor(db: Kysely<DbSchema>, options: KyselyDbOptions) {
    this.db = db;
    this.config = options.config;
    this.schema = options.schema;
    this.hooks = options.hooks;
  }

  private getModelFields(model: string): Record<string, { type: FieldType }> {
    return this.schema[model]?.fields ?? {};
  }

  private applyWhere<
    T extends {
      where(f: string, o: string, v: unknown): T;
      orWhere(f: string, o: string, v: unknown): T;
    },
  >(qb: T, where?: WhereClause): T {
    if (!where || where.length === 0) return qb;

    // Kysely uses .where() and .orWhere()
    let currentQb = qb;

    for (let i = 0; i < where.length; i++) {
      const condition = where[i];
      if (!condition) continue;

      const connector = i > 0 ? (where[i - 1]?.connector ?? "AND") : "AND";
      const field = condition.field;
      let operator = condition.operator ?? "=";
      let value = condition.value;

      // Map our abstract operators to SQL
      if (operator === "contains") {
        operator = "like";
        value = `%${value}%`;
      } else if (operator === "starts_with") {
        operator = "like";
        value = `${value}%`;
      } else if (operator === "ends_with") {
        operator = "like";
        value = `%${value}`;
      } else if (operator === "not_in") {
        operator = "not in" as "=";
      }

      const method = connector === "OR" ? "orWhere" : "where";
      currentQb = currentQb[method](field, operator, value);
    }

    return currentQb;
  }

  async create<T extends Record<string, unknown>>(options: CreateOptions<T>): Promise<T> {
    const fields = this.getModelFields(options.model);

    let dataToInsert = options.data as Record<string, unknown>;
    dataToInsert = await runHooks.beforeCreate(this.hooks, options.model, dataToInsert);

    const serializedData = serializeData(fields, dataToInsert);

    // Some Kysely dialects (like SQLite) don't support returning() on insert natively in all versions,
    // but Kysely handles `.returningAll()` polyfills where possible. For safety, if it's sqlite,
    // we might need to fetch it back if returning doesn't work, but let's assume Kysely handles it
    // or we just reconstruct the result from the input data if it contains the ID.
    let resultRecord: T;

    if (this.config.provider === "sqlite") {
      // SQLite returning is supported in recent versions, but taking a safe approach
      await (this.db.insertInto(options.model as keyof DbSchema) as unknown as InsertBuilder)
        .values(serializedData)
        .execute();

      const refetched = await (
        this.db.selectFrom(options.model as keyof DbSchema) as unknown as SelectBuilder
      )
        .selectAll()
        .where("id", "=", serializedData.id)
        .executeTakeFirst();

      resultRecord = deserializeData(fields, refetched || serializedData) as T;
    } else {
      const result =
        (await (this.db.insertInto(options.model as keyof DbSchema) as unknown as InsertBuilder)
          .values(serializedData)
          .returningAll()
          .executeTakeFirst()) || serializedData;

      resultRecord = deserializeData(fields, result) as T;
    }

    await runHooks.afterCreate(this.hooks, options.model, resultRecord as Record<string, unknown>);
    return resultRecord;
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);

    let qb = this.db.selectFrom(options.model as keyof DbSchema) as unknown as SelectBuilder;

    if (options.select) {
      qb = qb.select(options.select);
    } else {
      qb = qb.selectAll();
    }

    qb = this.applyWhere(qb, options.where);

    const result = await qb.executeTakeFirst();
    if (!result) return null;

    return deserializeData(fields, result) as T;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const fields = this.getModelFields(options.model);

    let qb = this.db.selectFrom(options.model as keyof DbSchema) as unknown as SelectBuilder;

    if (options.select) {
      qb = qb.select(options.select);
    } else {
      qb = qb.selectAll();
    }

    qb = this.applyWhere(qb, options.where);

    if (options.sortBy) {
      qb = qb.orderBy(options.sortBy.field, options.sortBy.direction);
    }

    if (options.limit !== undefined) {
      qb = qb.limit(options.limit);
    }

    if (options.offset !== undefined) {
      qb = qb.offset(options.offset);
    }

    const results = await qb.execute();
    return results.map((row) => deserializeData(fields, row)) as T[];
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);

    // 1. Fetch the target first to run hooks properly
    const target = await this.findOne({ model: options.model, where: options.where });
    if (!target) return null;

    // 2. Run hooks
    let updatedData = { ...target, ...(options.update as Record<string, unknown>) };
    updatedData = await runHooks.beforeUpdate(this.hooks, options.model, updatedData);

    // 3. Serialize only the updated fields for Kysely
    const updatePayload = serializeData(fields, options.update as Record<string, unknown>);

    // 4. Update
    let qb = (this.db.updateTable(options.model as keyof DbSchema) as unknown as UpdateBuilder).set(
      updatePayload
    );
    qb = this.applyWhere(qb, options.where);
    await qb.execute();

    // 5. Build the final result
    const resultRecord = deserializeData(fields, serializeData(fields, updatedData)) as T;

    await runHooks.afterUpdate(this.hooks, options.model, resultRecord as Record<string, unknown>);
    return resultRecord;
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const fields = this.getModelFields(options.model);
    const updatePayload = serializeData(fields, options.update as Record<string, unknown>);

    let qb = (this.db.updateTable(options.model as keyof DbSchema) as unknown as UpdateBuilder).set(
      updatePayload
    );
    qb = this.applyWhere(qb, options.where);

    const results = await qb.execute();
    return Number(results[0]?.numUpdatedRows || 0);
  }

  async delete(options: DeleteOptions): Promise<void> {
    await runHooks.beforeDelete(this.hooks, options.model, options.where);

    let qb = this.db.deleteFrom(options.model as keyof DbSchema) as unknown as DeleteBuilder;
    qb = this.applyWhere(qb, options.where);
    await qb.execute();

    await runHooks.afterDelete(this.hooks, options.model, options.where);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    let qb = this.db.deleteFrom(options.model as keyof DbSchema) as unknown as DeleteBuilder;
    qb = this.applyWhere(qb, options.where);

    const results = await qb.execute();
    return Number(results[0]?.numDeletedRows || 0);
  }

  async count(options: CountOptions): Promise<number> {
    let qb = this.db.selectFrom(options.model as keyof DbSchema) as unknown as SelectBuilder;
    qb = this.applyWhere(qb, options.where);

    // Use Kysely's count helper
    const { count } = this.db.fn;
    qb = (qb as unknown as { select(s: unknown): SelectBuilder }).select(count("id").as("c"));

    const result = await qb.executeTakeFirst();
    return Number((result as unknown as { c: number })?.c || 0);
  }

  async transaction<R>(callback: (trx: DatabaseTransactionAdapter) => Promise<R>): Promise<R> {
    return (await (
      this.db.transaction() as unknown as {
        execute(cb: (trx: Kysely<DbSchema>) => Promise<R>): Promise<R>;
      }
    ).execute(async (trx) => {
      // Create a transient adapter instance that delegates to the un-nested transaction
      const trxAdapter = new KyselyDbAdapter(trx, {
        config: this.config,
        schema: this.schema,
        hooks: this.hooks,
      });
      return await callback(trxAdapter);
    })) as R;
  }

  /**
   * Internal migration method. Generates generic tables based on the BmSchema.
   */
  async __createTable(model: string, definition: BmSchema[string]): Promise<void> {
    let schemaQb = this.db.schema.createTable(model).ifNotExists();

    for (const [fieldName, fieldDef] of Object.entries(definition.fields)) {
      let colType: string;

      switch (fieldDef.type) {
        case "string":
          colType = "varchar(255)"; // Simplify, use text/varchar
          break;
        case "number":
          // If primary key, usually integer autoincrement, but in better-media we use cuid/uuid strings
          colType = "integer";
          break;
        case "boolean":
          colType = this.config.provider === "sqlite" ? "integer" : "boolean";
          break;
        case "date":
          colType = "timestamp";
          break;
        case "json":
          colType = this.config.provider === "pg" ? "jsonb" : "text"; // JSON fallback
          break;
        default:
          colType = "text";
      }

      schemaQb = schemaQb.addColumn(
        fieldName,
        colType as "text",
        (col: {
          primaryKey(): typeof col;
          notNull(): typeof col;
          unique(): typeof col;
          references(r: string): typeof col;
          onDelete(o: string): typeof col;
        }) => {
          if (fieldDef.primaryKey) col = col.primaryKey();
          if (fieldDef.required) col = col.notNull();
          if (fieldDef.unique) col = col.unique();
          if (fieldDef.references) {
            col = col.references(`${fieldDef.references.model}.${fieldDef.references.field}`);
            if (fieldDef.references.onDelete) {
              col = col.onDelete(fieldDef.references.onDelete);
            }
          }
          return col;
        }
      );
    }

    await schemaQb.execute();
  }
}
