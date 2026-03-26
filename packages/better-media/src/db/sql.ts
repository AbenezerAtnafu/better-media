import type {
  BmSchema,
  FieldDefinition,
  ModelDefinition,
  SqlDialect,
  MigrationOperation,
} from "./types";
import { getColumnType } from "./plan";

function quoteIdent(ident: string, dialect: SqlDialect): string {
  // Keep it simple and safe; Better Media table/field names are controlled.
  if (dialect === "mysql") return `\`${ident}\``;
  return `"${ident}"`;
}

function onDeleteSql(
  onDelete?: FieldDefinition["references"] extends infer R
    ? R extends { onDelete?: infer D }
      ? D | string
      : string
    : string
): string {
  if (!onDelete) return "";
  const normalized = String(onDelete).toUpperCase();
  if (normalized === "CASCADE") return " ON DELETE CASCADE";
  if (normalized === "SET NULL") return " ON DELETE SET NULL";
  if (normalized === "RESTRICT") return " ON DELETE RESTRICT";
  return "";
}

function columnSql(
  table: string,
  name: string,
  field: FieldDefinition,
  dialect: SqlDialect
): string {
  const parts: string[] = [];
  parts.push(quoteIdent(name, dialect));
  parts.push(getColumnType(field, dialect));

  if (field.primaryKey) parts.push("PRIMARY KEY");
  if (field.required) parts.push("NOT NULL");
  if (field.unique) parts.push("UNIQUE");

  if (field.references) {
    const ref = field.references;
    const refTable = quoteIdent(ref.model, dialect);
    const refField = quoteIdent(ref.field, dialect);
    parts.push(`REFERENCES ${refTable}(${refField})${onDeleteSql(ref.onDelete)}`);
  }

  return parts.join(" ");
}

function createTableSql(table: string, definition: ModelDefinition, dialect: SqlDialect): string {
  const tableName = quoteIdent(table, dialect);
  const cols = Object.entries(definition.fields).map(([name, field]) =>
    columnSql(table, name, field, dialect)
  );
  const ifNotExists = dialect === "mssql" ? "" : " IF NOT EXISTS";
  return `CREATE TABLE${ifNotExists} ${tableName} (\n  ${cols.join(",\n  ")}\n);`;
}

function createIndexSql(
  table: string,
  indexName: string,
  fields: string[],
  unique: boolean | undefined,
  dialect: SqlDialect
): string {
  const idx = quoteIdent(indexName, dialect);
  const tbl = quoteIdent(table, dialect);
  const cols = fields.map((f) => quoteIdent(f, dialect)).join(", ");
  const uniqueSql = unique ? "UNIQUE " : "";
  const ifNotExists = dialect === "mssql" ? "" : " IF NOT EXISTS";
  return `CREATE ${uniqueSql}INDEX${ifNotExists} ${idx} ON ${tbl} (${cols});`;
}

function addColumnSql(
  table: string,
  field: string,
  definition: FieldDefinition,
  dialect: SqlDialect
): string {
  const tableName = quoteIdent(table, dialect);
  const columnDef = columnSql(table, field, definition, dialect);
  return `ALTER TABLE ${tableName} ADD COLUMN ${columnDef};`;
}

export function compileMigrationOperationsSql(options: {
  operations: MigrationOperation[];
  dialect: SqlDialect;
}): string {
  const { operations, dialect } = options;
  const statements: string[] = [];
  statements.push(`-- Better Media planned migrations (${dialect})`);

  if (dialect === "sqlite") {
    statements.push("PRAGMA foreign_keys = ON;");
  }

  for (const op of operations) {
    if (op.type === "createTable") {
      statements.push(createTableSql(op.table, op.definition, dialect));
      if (op.definition.indexes) {
        for (const index of op.definition.indexes) {
          const indexName = `idx_${op.table}_${index.fields.join("_")}`;
          statements.push(createIndexSql(op.table, indexName, index.fields, index.unique, dialect));
        }
      }
      continue;
    }
    if (op.type === "addColumn") {
      statements.push(addColumnSql(op.table, op.field, op.definition, dialect));
      continue;
    }
    if (op.type === "createIndex") {
      statements.push(createIndexSql(op.table, op.name, op.fields, op.unique, dialect));
    }
  }

  return statements.join("\n\n") + "\n";
}

export function generateCreateSchemaSql(options: {
  schema: BmSchema;
  dialect: SqlDialect;
}): string {
  const { schema, dialect } = options;

  const statements: string[] = [];
  statements.push(`-- Better Media schema (${dialect})`);

  // SQLite requires foreign keys enabled explicitly per-connection; harmless elsewhere.
  if (dialect === "sqlite") {
    statements.push("PRAGMA foreign_keys = ON;");
  }

  // Create tables first (FKs reference earlier tables in this schema, but SQL engines allow forward refs too).
  for (const [table, def] of Object.entries(schema)) {
    statements.push(createTableSql(table, def, dialect));
  }

  // Create indexes after.
  for (const [table, def] of Object.entries(schema)) {
    if (!def.indexes) continue;
    for (const index of def.indexes) {
      const indexName = `idx_${table}_${index.fields.join("_")}`;
      statements.push(createIndexSql(table, indexName, index.fields, index.unique, dialect));
    }
  }

  return statements.join("\n\n") + "\n";
}
