import { Kysely, sql } from "kysely";
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
  FieldDefinition,
  BmSchema,
  DbHooks,
  HookContext,
  ModelDefinition,
  MigrationOperation,
  SqlDialect,
  TableMetadata,
} from "better-media";
import { serializeData, deserializeData, runHooks, getColumnType } from "better-media";
import type { KyselyDbConfig } from "./kysely-db-config.interface";

export interface KyselyDbOptions {
  config: KyselyDbConfig;
  schema: BmSchema;
  hooks?: DbHooks;
}

export type DbSchema = Record<string, Record<string, unknown>>;

type AnyFunction = (...args: unknown[]) => unknown;

type KyselyBuilder = {
  where: (field: string, op: string, value: unknown) => KyselyBuilder;
  orWhere: (field: string, op: string, value: unknown) => KyselyBuilder;
  select: (fields: unknown) => KyselyBuilder;
  selectAll: () => KyselyBuilder;
  leftJoin: (table: string, left: string, right: string) => KyselyBuilder;
  orderBy: (field: string, direction: string) => KyselyBuilder;
  limit: (n: number) => KyselyBuilder;
  offset: (n: number) => KyselyBuilder;
  set: (data: Record<string, unknown>) => KyselyBuilder;
  values: (data: Record<string, unknown>) => KyselyBuilder;
  returningAll: () => KyselyBuilder;
  execute: () => Promise<unknown[] & { numUpdatedRows?: number; numDeletedRows?: number }>;
  executeTakeFirst: () => Promise<unknown>;
};

/**
 * SQL database adapter using Kysely.
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

  private getModelDefinition(model: string): ModelDefinition | undefined {
    return this.schema[model];
  }

  private getHookContext(model: string, trx?: DatabaseTransactionAdapter): HookContext {
    return {
      model,
      adapter: this,
      transaction: trx,
    };
  }

  private applyWhere(
    qb: KyselyBuilder,
    where?: WhereClause,
    model?: string,
    options?: { withDeleted?: boolean }
  ): KyselyBuilder {
    let currentQb = qb;
    const definition = model ? this.getModelDefinition(model) : undefined;

    // Soft delete filtering
    if (definition?.softDelete && !options?.withDeleted) {
      currentQb = currentQb.where("deletedAt", "is", null);
    }

    if (!where || where.length === 0) return currentQb;

    for (let i = 0; i < where.length; i++) {
      const condition = where[i];
      if (!condition) continue;

      const connector = i > 0 ? (where[i - 1]?.connector ?? "AND") : "AND";
      const field = condition.field;
      let operator = condition.operator ?? "=";
      let value = condition.value;

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
        operator = "not in" as "in";
      }

      const method = (connector === "OR" ? "orWhere" : "where") as keyof KyselyBuilder;
      currentQb = (currentQb[method] as AnyFunction)(field, operator, value) as KyselyBuilder;
    }

    return currentQb;
  }

  async create<T extends Record<string, unknown>>(options: CreateOptions<T>): Promise<T> {
    const fields = this.getModelFields(options.model);
    const context = this.getHookContext(options.model);

    let dataToInsert = options.data as Record<string, unknown>;
    dataToInsert = await runHooks.beforeCreate(this.hooks, dataToInsert, context);

    const serializedData = serializeData(fields, dataToInsert);
    let resultRecord: T;

    if (this.config.provider === "sqlite") {
      await (this.db.insertInto(options.model) as unknown as KyselyBuilder)
        .values(serializedData)
        .execute();

      const refetched = await (this.db.selectFrom(options.model) as unknown as KyselyBuilder)
        .selectAll()
        .where("id", "=", serializedData.id)
        .executeTakeFirst();

      resultRecord = deserializeData(
        fields,
        (refetched as Record<string, unknown>) || serializedData
      ) as T;
    } else {
      const result =
        (await (this.db.insertInto(options.model) as unknown as KyselyBuilder)
          .values(serializedData)
          .returningAll()
          .executeTakeFirst()) || serializedData;

      resultRecord = deserializeData(fields, result as Record<string, unknown>) as T;
    }

    await runHooks.afterCreate(this.hooks, resultRecord as Record<string, unknown>, context);
    return resultRecord;
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);
    let qb = this.db.selectFrom(options.model) as unknown as KyselyBuilder;

    if (options.select) {
      qb = qb.select(options.select);
    } else {
      qb = qb.selectAll();
    }

    qb = this.applyWhere(qb, options.where, options.model, { withDeleted: options.withDeleted });

    if (options.populate) {
      // Basic population via left joins if references exist
      for (const relation of options.populate) {
        const fieldDef = this.schema[options.model]?.fields[relation];
        if (fieldDef?.references) {
          qb = qb.leftJoin(
            fieldDef.references.model,
            `${options.model}.${relation}`,
            `${fieldDef.references.model}.${fieldDef.references.field}`
          );
        }
      }
    }

    const result = await qb.executeTakeFirst();
    if (!result) return null;

    return deserializeData(fields, result as Record<string, unknown>) as T;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const fields = this.getModelFields(options.model);
    let qb = this.db.selectFrom(options.model) as unknown as KyselyBuilder;

    if (options.select) {
      qb = qb.select(options.select);
    } else {
      qb = qb.selectAll();
    }

    qb = this.applyWhere(qb, options.where, options.model, { withDeleted: options.withDeleted });

    if (options.sortBy) {
      qb = qb.orderBy(options.sortBy.field, options.sortBy.direction);
    }

    if (options.limit !== undefined) qb = qb.limit(options.limit);
    if (options.offset !== undefined) qb = qb.offset(options.offset);

    const results = await (qb as { execute: AnyFunction }).execute();
    return (results as Record<string, unknown>[]).map((row) => deserializeData(fields, row)) as T[];
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const fields = this.getModelFields(options.model);
    const context = this.getHookContext(options.model);

    // We still need the current record for hooks (merging data)
    const target = await this.findOne({ model: options.model, where: options.where });
    if (!target) return null;

    let updatedData = { ...target, ...(options.update as Record<string, unknown>) };
    updatedData = await runHooks.beforeUpdate(this.hooks, updatedData, context);

    const updatePayload = serializeData(fields, options.update as Record<string, unknown>);

    let qb = (this.db.updateTable(options.model) as unknown as KyselyBuilder).set(updatePayload);
    qb = this.applyWhere(qb, options.where, options.model);

    let resultRecord: T;
    if (this.config.provider === "sqlite") {
      await qb.execute();
      resultRecord = deserializeData(fields, serializeData(fields, updatedData)) as T;
    } else {
      const result = await (qb as unknown as KyselyBuilder).returningAll().executeTakeFirst();
      resultRecord = deserializeData(
        fields,
        (result as Record<string, unknown>) || serializeData(fields, updatedData)
      ) as T;
    }

    await runHooks.afterUpdate(this.hooks, resultRecord as Record<string, unknown>, context);
    return resultRecord;
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const fields = this.getModelFields(options.model);
    const updatePayload = serializeData(fields, options.update as Record<string, unknown>);

    let qb = (this.db.updateTable(options.model) as unknown as KyselyBuilder).set(updatePayload);
    qb = this.applyWhere(
      qb as unknown as KyselyBuilder,
      options.where,
      options.model
    ) as KyselyBuilder;

    const results = (await qb.execute()) as unknown as { numUpdatedRows: bigint | number }[];
    return Number(results[0]?.numUpdatedRows || 0);
  }

  async delete(options: DeleteOptions): Promise<void> {
    const context = this.getHookContext(options.model);
    const definition = this.getModelDefinition(options.model);

    await runHooks.beforeDelete(this.hooks, options.where, context);

    if (definition?.softDelete) {
      await this.updateMany({
        model: options.model,
        where: options.where,
        update: { deletedAt: new Date() } as unknown as Record<string, unknown>,
      });
    } else {
      let qb = this.db.deleteFrom(options.model) as unknown as KyselyBuilder;
      qb = this.applyWhere(qb, options.where, options.model);
      await qb.execute();
    }

    await runHooks.afterDelete(this.hooks, options.where, context);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    const definition = this.getModelDefinition(options.model);

    if (definition?.softDelete) {
      return await this.updateMany({
        model: options.model,
        where: options.where,
        update: { deletedAt: new Date() } as unknown as Record<string, unknown>,
      });
    }

    let qb = this.db.deleteFrom(options.model) as unknown as KyselyBuilder;
    qb = this.applyWhere(qb, options.where, options.model);

    const results = (await qb.execute()) as unknown as { numDeletedRows: bigint | number }[];
    return Number(results[0]?.numDeletedRows || 0);
  }

  async count(options: CountOptions): Promise<number> {
    let qb = this.db.selectFrom(options.model) as unknown as KyselyBuilder;
    qb = this.applyWhere(qb, options.where, options.model);

    const { count } = this.db.fn as unknown as {
      count: (f: string) => { as: (a: string) => unknown };
    };
    qb = qb.select(count("id").as("c"));

    const result = (await qb.executeTakeFirst()) as { c: string | number } | undefined;
    return Number(result?.c || 0);
  }

  async raw<T = unknown>(query: string, params?: unknown[]): Promise<T> {
    const result = await (
      sql as unknown as {
        raw: (q: string, p: unknown) => { execute: (db: unknown) => Promise<{ rows: T }> };
      }
    )
      .raw(query, params)
      .execute(this.db);
    return result.rows;
  }

  async transaction<R>(callback: (trx: DatabaseTransactionAdapter) => Promise<R>): Promise<R> {
    return (await (
      this.db.transaction() as unknown as {
        execute: (cb: (trx: Kysely<DbSchema>) => Promise<R>) => Promise<R>;
      }
    ).execute(async (trx) => {
      const trxAdapter = new KyselyDbAdapter(trx, {
        config: this.config,
        schema: this.schema,
        hooks: this.hooks,
      });
      return await callback(trxAdapter);
    })) as R;
  }

  /** @internal Used by runMigrations — not part of the public DatabaseAdapter contract. */
  async __getMetadata(): Promise<TableMetadata[]> {
    const tables = await this.db.introspection.getTables();
    const dialect = this.__getDialect();

    let filtered = tables;
    if (dialect === "postgres") {
      const currentSchema = await this.getPostgresSchema();
      filtered = tables.filter((table) => {
        const schema = (table as unknown as { schema?: string }).schema;
        return !schema || schema === currentSchema;
      });
    }

    return filtered.map((table) => ({
      name: table.name,
      columns: table.columns.map((col) => ({
        name: col.name,
        dataType: col.dataType,
        isNullable: col.isNullable ?? true,
      })),
    }));
  }

  private async getPostgresSchema(): Promise<string> {
    try {
      const result = await sql<{
        search_path?: string;
        searchPath?: string;
      }>`SHOW search_path`.execute(this.db);
      const searchPath = result.rows[0]?.search_path ?? result.rows[0]?.searchPath;
      if (!searchPath) return "public";
      const schemas = searchPath
        .split(",")
        .map((s) => s.trim())
        .map((s) => s.replace(/^["']|["']$/g, ""))
        .filter((s) => !s.startsWith("$") && !s.startsWith("\\$"));
      return schemas[0] || "public";
    } catch {
      return "public";
    }
  }

  /** @internal Used by runMigrations to auto-detect the SQL dialect. */
  __getDialect(): SqlDialect {
    switch (this.config.provider) {
      case "pg":
        return "postgres";
      case "mysql":
        return "mysql";
      case "sqlite":
        return "sqlite";
      default:
        return "postgres";
    }
  }

  /** @internal Used by runMigrations — not part of the public DatabaseAdapter contract. */
  async __executeMigration(operation: MigrationOperation): Promise<void> {
    const dialect = this.__getDialect();

    if (operation.type === "createTable") {
      let builder = this.db.schema.createTable(operation.table).ifNotExists();

      for (const [name, field] of Object.entries(operation.definition.fields) as [
        string,
        FieldDefinition,
      ][]) {
        const type = getColumnType(field, dialect);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        builder = builder.addColumn(name, type as any, (col: any) => {
          if (field.primaryKey) col = col.primaryKey();
          if (field.required) col = col.notNull();
          if (field.unique) col = col.unique();
          if (field.references) {
            col = col
              .references(`${field.references.model}.${field.references.field}`)
              .onDelete(field.references.onDelete || "cascade");
          }
          return col;
        });
      }
      await builder.execute();

      // Create indexes
      if (operation.definition.indexes) {
        for (const index of operation.definition.indexes) {
          const indexName = `idx_${operation.table}_${index.fields.join("_")}`;
          let indexBuilder = this.db.schema
            .createIndex(indexName)
            .on(operation.table)
            .columns(index.fields);
          if (index.unique) {
            indexBuilder = indexBuilder.unique();
          }
          await indexBuilder.execute();
        }
      }
    } else if (operation.type === "addColumn") {
      const type = getColumnType(operation.definition, dialect);
      await this.db.schema
        .alterTable(operation.table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .addColumn(operation.field, type as any, (col: any) => {
          if (operation.definition.required) col = col.notNull();
          if (operation.definition.unique) col = col.unique();
          if (operation.definition.references) {
            col = col
              .references(
                `${operation.definition.references.model}.${operation.definition.references.field}`
              )
              .onDelete(operation.definition.references.onDelete || "cascade");
          }
          return col;
        })
        .execute();
    } else if (operation.type === "createIndex") {
      let builder = this.db.schema
        .createIndex(operation.name)
        .on(operation.table)
        .columns(operation.fields);
      if (operation.unique) {
        builder = builder.unique();
      }
      await builder.execute();
    }
  }
}
