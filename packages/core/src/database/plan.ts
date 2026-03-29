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
    if (dialect === "postgres") return "uuid";
    return dialect === "mysql" || dialect === "mssql" ? "varchar(36)" : "text";
  }
  if (field.references && field.type === "string" && dialect === "postgres") {
    return "uuid";
  }

  const types = dialectMap[field.type];
  if (!types) return "text";

  const type = types[dialect];
  return type || "text";
}

export function matchType(dbType: string, expectedType: FieldType, dialect: SqlDialect): boolean {
  const normalizedDb = (dbType.toLowerCase().split("(")[0] || "").trim();
  const normalizedMap: Record<SqlDialect, Record<FieldType, string[]>> = {
    postgres: {
      string: ["character varying", "varchar", "text", "uuid"],
      number: ["int4", "integer", "bigint", "smallint", "numeric", "real", "double precision"],
      boolean: ["bool", "boolean"],
      date: ["timestamptz", "timestamp", "date"],
      json: ["json", "jsonb"],
    },
    mysql: {
      string: ["varchar", "text", "uuid", "char"],
      number: ["integer", "int", "bigint", "smallint", "decimal", "float", "double"],
      boolean: ["boolean", "tinyint", "bit"],
      date: ["timestamp", "datetime", "date"],
      json: ["json", "text", "longtext"],
    },
    sqlite: {
      string: ["text", "varchar"],
      number: ["integer", "real", "numeric"],
      boolean: ["integer", "boolean"],
      date: ["date", "text", "integer"],
      json: ["text"],
    },
    mssql: {
      string: ["varchar", "nvarchar", "uniqueidentifier"],
      number: ["int", "bigint", "smallint", "decimal", "float", "double", "numeric"],
      boolean: ["bit", "smallint"],
      date: ["datetime2", "date", "datetime", "timestamp"],
      json: ["varchar", "nvarchar"],
    },
  };

  return normalizedMap[dialect][expectedType].includes(normalizedDb);
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

      // Missing indexes: not yet diffed against DB metadata (createIndex ops TBD).
    }

    return operations;
  }
}

/**
 * Applies a list of migration operations to an existing metadata state to project
 * what the database will look like after the migration.
 */
export function applyOperationsToMetadata(
  currentMetadata: TableMetadata[],
  operations: MigrationOperation[],
  dialect: SqlDialect
): TableMetadata[] {
  const metadata = JSON.parse(JSON.stringify(currentMetadata)) as TableMetadata[];

  for (const op of operations) {
    if (op.type === "createTable") {
      const columns = Object.entries(op.definition.fields).map(([name, field]) => ({
        name,
        dataType: getColumnType(field, dialect),
        isNullable: !field.required && !field.primaryKey,
        isUnique: field.unique || field.primaryKey,
      }));
      metadata.push({ name: op.table, columns });
    } else if (op.type === "addColumn") {
      const table = metadata.find((t) => t.name === op.table);
      if (table) {
        table.columns.push({
          name: op.field,
          dataType: getColumnType(op.definition, dialect),
          isNullable: !op.definition.required,
          isUnique: !!op.definition.unique,
        });
      }
    }
    // Handle other operation types (like createIndex) if metadata starts tracking them
  }

  return metadata;
}
