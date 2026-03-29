import type {
  CountOptions,
  CreateOptions,
  DatabaseAdapter,
  DatabaseTransactionAdapter,
  DeleteOptions,
  FindOptions,
  UpdateOptions,
  WhereClause,
  FieldDefinition,
  MigrationOperation,
  SqlDialect,
  TableMetadata,
} from "@better-media/core";
import {
  schema,
  deserializeData,
  serializeData,
  getColumnType,
  toCamelCase,
  toDbFieldName,
  isPgPoolLike,
  type PgPoolLike,
  type PgClientLike,
  type Queryable,
  type DatabaseHookContext,
  type QueryResultLike,
} from "@better-media/core";

export type { PgPoolLike, PgClientLike, Queryable, QueryResultLike, DatabaseHookContext };

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function rowToAppKeys(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[toCamelCase(key)] = value;
  }
  return mapped;
}

function buildWhere(where?: WhereClause, startAt = 1): { sql: string; values: unknown[] } {
  if (!where?.length) return { sql: "", values: [] };
  const parts: string[] = [];
  const values: unknown[] = [];
  let idx = startAt;

  for (let i = 0; i < where.length; i++) {
    const condition = where[i];
    if (!condition) continue;

    const connector = i > 0 ? (where[i - 1]?.connector ?? "AND") : "AND";
    const field = quote(toDbFieldName(condition.field));
    const op = condition.operator ?? "=";

    if (i > 0) parts.push(connector);

    if (op === "contains" || op === "starts_with" || op === "ends_with") {
      const raw = String(condition.value ?? "");
      const value = op === "contains" ? `%${raw}%` : op === "starts_with" ? `${raw}%` : `%${raw}`;
      parts.push(`${field} LIKE $${idx}`);
      values.push(value);
      idx += 1;
      continue;
    }

    if (op === "in" || op === "not_in") {
      const list = Array.isArray(condition.value) ? condition.value : [condition.value];
      if (!list.length) {
        parts.push(op === "in" ? "FALSE" : "TRUE");
        continue;
      }
      const placeholders = list.map(() => `$${idx++}`).join(", ");
      parts.push(`${field} ${op === "in" ? "IN" : "NOT IN"} (${placeholders})`);
      values.push(...list);
      continue;
    }

    if (condition.value === null && (op === "=" || op === "!=")) {
      parts.push(`${field} ${op === "=" ? "IS" : "IS NOT"} NULL`);
      continue;
    }

    const sqlOp = op === "!=" ? "<>" : op;
    parts.push(`${field} ${sqlOp} $${idx}`);
    values.push(condition.value);
    idx += 1;
  }

  if (!parts.length) return { sql: "", values: [] };
  return { sql: ` WHERE ${parts.join(" ")}`, values };
}

class PostgresDatabaseAdapter implements DatabaseAdapter {
  readonly id = "postgres";

  constructor(private readonly db: Queryable) {}

  private modelFields(model: string): Record<string, { type: FieldDefinition["type"] }> {
    return schema[model]?.fields ?? {};
  }

  async create<T extends Record<string, unknown>>(options: CreateOptions<T>): Promise<T> {
    const fields = this.modelFields(options.model);
    const serialized = serializeData(fields, options.data as Record<string, unknown>);
    const keys = Object.keys(serialized);
    const columns = keys.map((k) => quote(toDbFieldName(k))).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map((k) => serialized[k]);
    const result = await this.db.query(
      `INSERT INTO ${quote(options.model)} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return deserializeData(fields, rowToAppKeys(result.rows[0] ?? serialized)) as T;
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const rows = await this.findMany({ ...options, limit: 1 });
    return (rows[0] as T | undefined) ?? null;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const fields = this.modelFields(options.model);
    const select =
      options.select && options.select.length > 0
        ? options.select.map((f) => `${quote(toDbFieldName(f))} AS ${quote(f)}`).join(", ")
        : "*";
    let query = `SELECT ${select} FROM ${quote(options.model)}`;
    const where = buildWhere(options.where);
    query += where.sql;
    const values = [...where.values];

    if (options.sortBy) {
      query += ` ORDER BY ${quote(toDbFieldName(options.sortBy.field))} ${options.sortBy.direction.toUpperCase()}`;
    }
    if (typeof options.limit === "number") {
      query += ` LIMIT $${values.length + 1}`;
      values.push(options.limit);
    }
    if (typeof options.offset === "number") {
      query += ` OFFSET $${values.length + 1}`;
      values.push(options.offset);
    }

    const result = await this.db.query(query, values);
    return result.rows.map((r) => deserializeData(fields, rowToAppKeys(r)) as T);
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const updated = await this.updateMany(options);
    if (!updated) return null;
    return this.findOne({ model: options.model, where: options.where });
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const fields = this.modelFields(options.model);
    const serialized = serializeData(fields, options.update as Record<string, unknown>);
    const entries = Object.entries(serialized);
    if (!entries.length) return 0;

    const setSql = entries.map(([key], i) => `${quote(toDbFieldName(key))} = $${i + 1}`).join(", ");
    const setValues = entries.map(([, value]) => value);
    const where = buildWhere(options.where, setValues.length + 1);
    const query = `UPDATE ${quote(options.model)} SET ${setSql}${where.sql}`;
    const result = await this.db.query(query, [...setValues, ...where.values]);
    return Number(result.rowCount ?? 0);
  }

  async delete(options: DeleteOptions): Promise<void> {
    await this.deleteMany(options);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    const where = buildWhere(options.where);
    const query = `DELETE FROM ${quote(options.model)}${where.sql}`;
    const result = await this.db.query(query, where.values);
    return Number(result.rowCount ?? 0);
  }

  async count(options: CountOptions): Promise<number> {
    const where = buildWhere(options.where);
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM ${quote(options.model)}${where.sql}`,
      where.values
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  async raw<T = unknown>(query: string, params?: unknown[]): Promise<T> {
    const result = await this.db.query(query, params);
    return result.rows as T;
  }

  async transaction<R>(callback: (trx: DatabaseTransactionAdapter) => Promise<R>): Promise<R> {
    const pool = this.db as PgPoolLike;
    if (typeof pool.connect !== "function") {
      throw new Error("[better-media] The provided Postgres client does not support transactions.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const trxAdapter = new PostgresDatabaseAdapter(client);
      const result = await callback(trxAdapter);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }

  __getDialect(): SqlDialect {
    return "postgres";
  }

  async __getMetadata(): Promise<TableMetadata[]> {
    const result = await this.db.query(
      `SELECT table_name AS "tableName", column_name AS "columnName", data_type AS "dataType", is_nullable AS "isNullable"
       FROM information_schema.columns
       WHERE table_schema = current_schema()
       ORDER BY table_name, ordinal_position`
    );

    const grouped = new Map<string, TableMetadata>();
    for (const row of result.rows as Array<Record<string, unknown>>) {
      const tableName = String(row.tableName);
      if (!grouped.has(tableName)) grouped.set(tableName, { name: tableName, columns: [] });
      grouped.get(tableName)!.columns.push({
        name: toCamelCase(String(row.columnName)),
        dataType: String(row.dataType),
        isNullable: String(row.isNullable).toUpperCase() === "YES",
      });
    }
    return [...grouped.values()];
  }

  async __executeMigration(operation: MigrationOperation): Promise<void> {
    if (operation.type === "createTable") {
      const columns = (Object.entries(operation.definition.fields) as [string, FieldDefinition][])
        .map(([name, field]) => {
          const parts = [quote(toDbFieldName(name)), getColumnType(field, "postgres")];
          if (field.primaryKey) parts.push("PRIMARY KEY");
          if (field.required) parts.push("NOT NULL");
          if (field.unique) parts.push("UNIQUE");
          if (field.references) {
            parts.push(
              `REFERENCES ${quote(field.references.model)}(${quote(toDbFieldName(field.references.field))}) ON DELETE ${String(
                field.references.onDelete ?? "CASCADE"
              ).toUpperCase()}`
            );
          }
          return parts.join(" ");
        })
        .join(", ");

      await this.db.query(`CREATE TABLE IF NOT EXISTS ${quote(operation.table)} (${columns})`);

      for (const index of operation.definition.indexes ?? []) {
        const indexName = `idx_${operation.table}_${index.fields.map((f: string) => toDbFieldName(f)).join("_")}`;
        await this.db.query(
          `CREATE ${index.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quote(indexName)} ON ${quote(
            operation.table
          )} (${index.fields.map((f) => quote(toDbFieldName(f))).join(", ")})`
        );
      }
      return;
    }

    if (operation.type === "addColumn") {
      const field = operation.definition;
      const parts = [
        quote(toDbFieldName(operation.field)),
        getColumnType(operation.definition as FieldDefinition, "postgres"),
      ];
      if (field.required) parts.push("NOT NULL");
      if (field.unique) parts.push("UNIQUE");
      if (field.references) {
        parts.push(
          `REFERENCES ${quote(field.references.model)}(${quote(toDbFieldName(field.references.field))}) ON DELETE ${String(
            field.references.onDelete ?? "CASCADE"
          ).toUpperCase()}`
        );
      }
      await this.db.query(
        `ALTER TABLE ${quote(operation.table)} ADD COLUMN IF NOT EXISTS ${parts.join(" ")}`
      );
      return;
    }

    if (operation.type === "createIndex") {
      await this.db.query(
        `CREATE ${operation.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quote(
          operation.name
        )} ON ${quote(operation.table)} (${operation.fields.map((f) => quote(toDbFieldName(f))).join(", ")})`
      );
    }
  }
}

export function postgresDatabase(pool: PgPoolLike): DatabaseAdapter {
  return new PostgresDatabaseAdapter(pool);
}

export function toDatabaseAdapter(database: DatabaseAdapter | PgPoolLike): DatabaseAdapter {
  if (isPgPoolLike(database) && typeof (database as { create?: unknown }).create !== "function") {
    return postgresDatabase(database);
  }
  return database as DatabaseAdapter;
}
