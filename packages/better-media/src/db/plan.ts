import type {
  BmSchema,
  FieldDefinition,
  FieldType,
  SqlDialect,
  TableMetadata,
  MigrationOperation,
} from "./types";

const dialectMap: Record<FieldType, Record<SqlDialect, string>> = {
  string: {
    postgres: "text",
    mysql: "varchar(255)",
    sqlite: "text",
    mssql: "varchar(255)",
  },
  number: {
    postgres: "integer",
    mysql: "integer",
    sqlite: "integer",
    mssql: "integer",
  },
  boolean: {
    postgres: "boolean",
    mysql: "boolean",
    sqlite: "integer",
    mssql: "bit",
  },
  date: {
    postgres: "timestamp",
    mysql: "datetime",
    sqlite: "text",
    mssql: "datetime2",
  },
  json: {
    postgres: "jsonb",
    mysql: "json",
    sqlite: "text",
    mssql: "nvarchar(max)",
  },
};

export function getColumnType(field: FieldDefinition, dialect: SqlDialect): string {
  // Overrides for specific cases
  if (field.primaryKey && field.type === "string") {
    return dialect === "mysql" || dialect === "mssql" ? "varchar(36)" : "text";
  }

  const types = dialectMap[field.type];
  if (!types) return "text";

  const type = types[dialect];
  return type || "text";
}

export function matchType(dbType: string, expectedType: FieldType, dialect: SqlDialect): boolean {
  const normalizedDb = (dbType.toLowerCase().split("(")[0] || "").trim();
  const types = dialectMap[expectedType];
  const mapped = ((types ? types[dialect] : "text") || "text").toLowerCase().split("(")[0]!.trim();

  // Common aliases
  const aliases: Record<string, string[]> = {
    integer: ["int", "int4", "int8", "bigint", "smallint", "tinyint"],
    text: ["varchar", "nvarchar", "character varying", "mediumtext", "longtext"],
    timestamp: ["timestamptz", "datetime", "datetime2", "date"],
    boolean: ["bool", "bit", "tinyint"],
  };

  if (normalizedDb === mapped) return true;
  if (aliases[mapped]?.includes(normalizedDb)) return true;

  return false;
}

/**
 * MigrationPlanner calculates the delta between the desired schema and the actual DB state.
 */
export class MigrationPlanner {
  constructor(private readonly dialect: SqlDialect) {}

  plan(schema: BmSchema, currentTables: TableMetadata[]): MigrationOperation[] {
    const operations: MigrationOperation[] = [];

    for (const [tableName, model] of Object.entries(schema)) {
      const existingTable = currentTables.find((t) => t.name === tableName);

      if (!existingTable) {
        // Table doesn't exist
        operations.push({ type: "createTable", table: tableName, definition: model });
        continue;
      }

      // Table exists, check for missing columns
      for (const [fieldName, fieldDef] of Object.entries(model.fields)) {
        const existingColumn = existingTable.columns.find((c) => c.name === fieldName);

        if (!existingColumn) {
          operations.push({
            type: "addColumn",
            table: tableName,
            field: fieldName,
            definition: fieldDef,
          });
        } else {
          // Optional: Check for type mismatches (logging only for now to avoid destructive changes)
          if (!matchType(existingColumn.dataType, fieldDef.type, this.dialect)) {
            console.warn(
              `[BetterMedia] Type mismatch for ${tableName}.${fieldName}: ` +
                `Expected ${fieldDef.type} but found ${existingColumn.dataType} in DB.`
            );
          }
        }
      }

      // Check for missing indexes
      if (model.indexes) {
        for (const index of model.indexes) {
          const indexName = `idx_${tableName}_${index.fields.join("_")}`;
          // This is a simple check; a more robust one would introspect indexes too
          // For now, we assume if the table is new, indexes are created with it.
          // In "diff" mode, we might want to check if the index exists.
          console.log(indexName);
        }
      }
    }

    return operations;
  }
}
