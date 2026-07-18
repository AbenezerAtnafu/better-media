import {
  eq,
  ne,
  lt,
  lte,
  gt,
  gte,
  inArray,
  notInArray,
  ilike,
  and,
  or,
  isNull,
  asc,
  desc,
  count,
  sql,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
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
import type { DrizzleDb, DrizzleDbConfig } from "./drizzle-db-config.interface";

export interface DrizzleDbOptions {
  config: DrizzleDbConfig;
  /** Maps better-media model names to Drizzle table objects, e.g. `{ media: mediaTable }` */
  schema: Record<string, Record<string, unknown>>;
  /** better-media field definitions used for serialization/deserialization and hooks */
  bmSchema: BmSchema;
  hooks?: DbHooks;
}

function resolveTable(
  schema: Record<string, Record<string, unknown>>,
  model: string
): Record<string, unknown> {
  const table = schema[model];
  if (!table) {
    throw new Error(
      `DrizzleDbAdapter: no table found for model "${model}". Add it to the schema map passed to drizzleAdapter().`
    );
  }
  return table;
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function getColumn(table: Record<string, unknown>, field: string, camelCase?: boolean): AnyColumn {
  const col = camelCase ? (table[toSnakeCase(field)] ?? table[field]) : table[field];
  return col as AnyColumn;
}

function patternMatch(col: AnyColumn, pattern: string, provider: DrizzleDbConfig["provider"]): SQL {
  // PostgreSQL has native ILIKE; MySQL/SQLite need LOWER() LIKE LOWER()
  if (provider === "pg") return ilike(col, pattern);
  return sql`LOWER(${col}) LIKE LOWER(${pattern})`;
}

function buildConditionExpr(
  col: AnyColumn,
  operator: string | undefined,
  value: unknown,
  provider: DrizzleDbConfig["provider"]
): SQL {
  switch (operator) {
    case "!=":
      return ne(col, value);
    case "<":
      return lt(col, value);
    case "<=":
      return lte(col, value);
    case ">":
      return gt(col, value);
    case ">=":
      return gte(col, value);
    case "in": {
      const vals = value as unknown[];
      // Empty inArray produces invalid SQL — short-circuit to always-false
      if (vals.length === 0) return sql`false`;
      return inArray(col, vals);
    }
    case "not_in": {
      const vals = value as unknown[];
      // Empty notInArray is always true
      if (vals.length === 0) return sql`true`;
      return notInArray(col, vals);
    }
    case "contains":
      return patternMatch(col, `%${String(value)}%`, provider);
    case "starts_with":
      return patternMatch(col, `${String(value)}%`, provider);
    case "ends_with":
      return patternMatch(col, `%${String(value)}`, provider);
    case "like":
      return patternMatch(col, value as string, provider);
    default:
      return eq(col, value);
  }
}

function buildWhereCondition(
  table: Record<string, unknown>,
  where?: WhereClause,
  definition?: ModelDefinition,
  options?: {
    withDeleted?: boolean;
    camelCase?: boolean;
    provider?: DrizzleDbConfig["provider"];
  }
): SQL | undefined {
  const provider = options?.provider ?? "pg";

  const softDeleteExpr =
    definition?.softDelete && !options?.withDeleted
      ? isNull(getColumn(table, "deletedAt", options?.camelCase))
      : undefined;

  if (!where || where.length === 0) return softDeleteExpr;

  const first = where[0]!;
  let result: SQL | undefined = buildConditionExpr(
    getColumn(table, first.field, options?.camelCase),
    first.operator,
    first.value,
    provider
  );

  for (let i = 1; i < where.length; i++) {
    const cond = where[i]!;
    const connector = where[i - 1]?.connector ?? "AND";
    const expr = buildConditionExpr(
      getColumn(table, cond.field, options?.camelCase),
      cond.operator,
      cond.value,
      provider
    );
    result = connector === "OR" ? or(result, expr) : and(result, expr);
  }

  return softDeleteExpr ? and(softDeleteExpr, result) : result;
}

export class DrizzleDbAdapter implements DatabaseAdapter {
  private readonly db: DrizzleDb;
  private readonly config: DrizzleDbConfig;
  private readonly schema: Record<string, Record<string, unknown>>;
  private readonly bmSchema: BmSchema;
  private readonly hooks?: DbHooks;

  constructor(db: DrizzleDb, options: DrizzleDbOptions) {
    this.db = db;
    this.config = options.config;
    this.schema = options.schema;
    this.bmSchema = options.bmSchema;
    this.hooks = options.hooks;
  }

  private getModelFields(model: string): Record<string, { type: FieldType }> {
    return this.bmSchema[model]?.fields ?? {};
  }

  private getModelDefinition(model: string): ModelDefinition | undefined {
    return this.bmSchema[model];
  }

  private getHookContext(model: string, trx?: DatabaseTransactionAdapter): DatabaseHookContext {
    return { model, adapter: this, transaction: trx };
  }

  async create<T extends Record<string, unknown>>(options: CreateOptions<T>): Promise<T> {
    const table = resolveTable(this.schema, options.model);
    const fields = this.getModelFields(options.model);
    const context = this.getHookContext(options.model);

    let data = options.data as Record<string, unknown>;
    data = await runHooks.beforeCreate(this.hooks, data, context);
    const serialized = serializeData(fields, data);

    let resultRow: Record<string, unknown>;

    if (this.config.provider === "mysql") {
      await this.db.insert(table).values(serialized);
      const rows = await this.db
        .select()
        .from(table)
        .where(eq(getColumn(table, "id", this.config.camelCase), serialized["id"]))
        .limit(1);
      resultRow = (rows as Record<string, unknown>[])[0] ?? serialized;
    } else {
      const rows = await this.db.insert(table).values(serialized).returning();
      resultRow = (rows as Record<string, unknown>[])[0] ?? serialized;
    }

    const result = deserializeData(fields, resultRow) as T;
    await runHooks.afterCreate(this.hooks, result as Record<string, unknown>, context);
    return result;
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const table = resolveTable(this.schema, options.model);
    const fields = this.getModelFields(options.model);
    const definition = this.getModelDefinition(options.model);
    const condition = buildWhereCondition(table, options.where, definition, {
      withDeleted: options.withDeleted,
      camelCase: this.config.camelCase,
      provider: this.config.provider,
    });

    let qb;
    if (options.select && options.select.length > 0) {
      const cols = (options.select as string[]).reduce<Record<string, unknown>>((acc, f) => {
        acc[f] = getColumn(table, f, this.config.camelCase);
        return acc;
      }, {});
      qb = this.db.select(cols).from(table);
    } else {
      qb = this.db.select().from(table);
    }

    const rows = await qb.where(condition).limit(1);
    if (!rows || (rows as unknown[]).length === 0) return null;
    return deserializeData(fields, (rows as Record<string, unknown>[])[0]!) as T;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const table = resolveTable(this.schema, options.model);
    const fields = this.getModelFields(options.model);
    const definition = this.getModelDefinition(options.model);
    const condition = buildWhereCondition(table, options.where, definition, {
      withDeleted: options.withDeleted,
      camelCase: this.config.camelCase,
      provider: this.config.provider,
    });

    let qb;
    if (options.select && options.select.length > 0) {
      const cols = (options.select as string[]).reduce<Record<string, unknown>>((acc, f) => {
        acc[f] = getColumn(table, f, this.config.camelCase);
        return acc;
      }, {});
      qb = this.db.select(cols).from(table);
    } else {
      qb = this.db.select().from(table);
    }

    qb = qb.where(condition);

    if (options.sortBy) {
      const col = getColumn(table, options.sortBy.field, this.config.camelCase);
      qb = qb.orderBy(options.sortBy.direction === "desc" ? desc(col) : asc(col));
    }

    if (options.limit !== undefined) qb = qb.limit(options.limit);
    if (options.offset !== undefined) qb = qb.offset(options.offset);

    const rows = await qb;
    return (rows as Record<string, unknown>[]).map((row) => deserializeData(fields, row) as T);
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const table = resolveTable(this.schema, options.model);
    const fields = this.getModelFields(options.model);
    const definition = this.getModelDefinition(options.model);
    const context = this.getHookContext(options.model);

    const target = await this.findOne({ model: options.model, where: options.where });
    if (!target) return null;

    let merged = { ...target, ...(options.update as Record<string, unknown>) };
    merged = await runHooks.beforeUpdate(this.hooks, merged, context);
    const payload = serializeData(fields, options.update as Record<string, unknown>);
    const condition = buildWhereCondition(table, options.where, definition, {
      camelCase: this.config.camelCase,
      provider: this.config.provider,
    });

    let resultRow: Record<string, unknown>;

    if (this.config.provider === "mysql") {
      await this.db.update(table).set(payload).where(condition);
      const rows = await this.db.select().from(table).where(condition).limit(1);
      resultRow = (rows as Record<string, unknown>[])[0] ?? serializeData(fields, merged);
    } else {
      const rows = await this.db.update(table).set(payload).where(condition).returning();
      resultRow = (rows as Record<string, unknown>[])[0] ?? serializeData(fields, merged);
    }

    const result = deserializeData(fields, resultRow) as T;
    await runHooks.afterUpdate(this.hooks, result as Record<string, unknown>, context);
    return result;
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const table = resolveTable(this.schema, options.model);
    const fields = this.getModelFields(options.model);
    const definition = this.getModelDefinition(options.model);
    const payload = serializeData(fields, options.update as Record<string, unknown>);
    const condition = buildWhereCondition(table, options.where, definition, {
      camelCase: this.config.camelCase,
      provider: this.config.provider,
    });

    const result = await this.db.update(table).set(payload).where(condition);
    const r = result;
    return Number(r?.rowCount ?? r?.[0]?.affectedRows ?? r?.changes ?? 0);
  }

  async delete(options: DeleteOptions): Promise<void> {
    const table = resolveTable(this.schema, options.model);
    const definition = this.getModelDefinition(options.model);
    const context = this.getHookContext(options.model);

    await runHooks.beforeDelete(this.hooks, options.where, context);

    if (definition?.softDelete) {
      await this.updateMany({
        model: options.model,
        where: options.where,
        update: { deletedAt: new Date() } as unknown as Record<string, unknown>,
      });
    } else {
      const condition = buildWhereCondition(table, options.where, definition, {
        camelCase: this.config.camelCase,
      });
      await this.db.delete(table).where(condition);
    }

    await runHooks.afterDelete(this.hooks, options.where, context);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    const table = resolveTable(this.schema, options.model);
    const definition = this.getModelDefinition(options.model);

    if (definition?.softDelete) {
      return await this.updateMany({
        model: options.model,
        where: options.where,
        update: { deletedAt: new Date() } as unknown as Record<string, unknown>,
      });
    }

    const condition = buildWhereCondition(table, options.where, definition, {
      camelCase: this.config.camelCase,
      provider: this.config.provider,
    });
    const result = await this.db.delete(table).where(condition);
    const r = result;
    return Number(r?.rowCount ?? r?.[0]?.affectedRows ?? r?.changes ?? 0);
  }

  async count(options: CountOptions): Promise<number> {
    const table = resolveTable(this.schema, options.model);
    const definition = this.getModelDefinition(options.model);
    const condition = buildWhereCondition(table, options.where, definition, {
      camelCase: this.config.camelCase,
      provider: this.config.provider,
    });

    const rows = await this.db.select({ c: count() }).from(table).where(condition);

    return Number((rows as { c: number | string }[])[0]?.c ?? 0);
  }

  async raw<T = unknown>(query: string): Promise<T> {
    const result = await this.db.execute(sql.raw(query));
    return result as T;
  }

  async transaction<R>(callback: (trx: DatabaseTransactionAdapter) => Promise<R>): Promise<R> {
    return this.db.transaction(async (tx: unknown) => {
      const trxAdapter = new DrizzleDbAdapter(tx, {
        config: this.config,
        schema: this.schema,
        bmSchema: this.bmSchema,
        hooks: this.hooks,
      });
      return await callback(trxAdapter);
    });
  }

  __executeMigration(): Promise<void> {
    return Promise.reject(
      new Error(
        "DrizzleDbAdapter does not support runMigrations(). Use drizzle-kit to manage your database schema."
      )
    );
  }

  __getMetadata(): Promise<never[]> {
    return Promise.reject(
      new Error(
        "DrizzleDbAdapter does not support runMigrations(). Use drizzle-kit to manage your database schema."
      )
    );
  }
}
