import type { BmSchema, FieldDefinition, SqlDialect } from "@better-media/core";

type DrizzleProvider = "pg" | "mysql" | "sqlite";

export function dialectToProvider(dialect: SqlDialect): DrizzleProvider {
  if (dialect === "postgres") return "pg";
  if (dialect === "mysql") return "mysql";
  return "sqlite";
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function modelVarName(modelName: string): string {
  return snakeToCamel(modelName);
}

function indexName(tableName: string, fields: string[]): string {
  return `idx_${tableName}_${fields.map(camelToSnake).join("_")}`;
}

// ─── column type per provider ────────────────────────────────────────────────

function pgColFn(fieldName: string, field: FieldDefinition): string {
  const col = camelToSnake(fieldName);
  switch (field.type) {
    case "number":
      return `integer("${col}")`;
    case "boolean":
      return `boolean("${col}")`;
    case "date":
      return `timestamp("${col}", { mode: "date" })`;
    case "json":
      return `jsonb("${col}")`;
    default:
      return `text("${col}")`;
  }
}

function mysqlColFn(fieldName: string, field: FieldDefinition): string {
  const col = camelToSnake(fieldName);
  switch (field.type) {
    case "number":
      return `int("${col}")`;
    case "boolean":
      return `boolean("${col}")`;
    case "date":
      return `datetime("${col}", { mode: "date" })`;
    case "json":
      return `json("${col}")`;
    default:
      return `text("${col}")`;
  }
}

function sqliteColFn(fieldName: string, field: FieldDefinition): string {
  const col = camelToSnake(fieldName);
  switch (field.type) {
    case "number":
      return `integer("${col}")`;
    case "boolean":
      return `integer("${col}", { mode: "boolean" })`;
    case "date":
      return `integer("${col}", { mode: "timestamp" })`;
    case "json":
      return `text("${col}", { mode: "json" })`;
    default:
      return `text("${col}")`;
  }
}

function getColFn(fieldName: string, field: FieldDefinition, provider: DrizzleProvider): string {
  switch (provider) {
    case "pg":
      return pgColFn(fieldName, field);
    case "mysql":
      return mysqlColFn(fieldName, field);
    case "sqlite":
      return sqliteColFn(fieldName, field);
  }
}

// ─── chain modifiers ─────────────────────────────────────────────────────────

function buildColChain(
  fieldName: string,
  field: FieldDefinition,
  provider: DrizzleProvider
): string {
  let chain = getColFn(fieldName, field, provider);
  if (field.primaryKey) chain += ".primaryKey()";
  if (field.required && !field.primaryKey) chain += ".notNull()";
  if (field.unique && !field.primaryKey) chain += ".unique()";
  if (field.references) {
    const refVar = modelVarName(field.references.model);
    const onDelete = field.references.onDelete ?? "cascade";
    chain += `.references(() => ${refVar}.${field.references.field}, { onDelete: "${onDelete}" })`;
  }
  return chain;
}

// ─── imports ─────────────────────────────────────────────────────────────────

function collectImports(
  schema: BmSchema,
  provider: DrizzleProvider
): { modulePath: string; names: string[] } {
  const names = new Set<string>();

  switch (provider) {
    case "pg":
      names.add("pgTable");
      break;
    case "mysql":
      names.add("mysqlTable");
      break;
    case "sqlite":
      names.add("sqliteTable");
      break;
  }

  for (const model of Object.values(schema)) {
    for (const field of Object.values(model.fields)) {
      switch (provider) {
        case "pg":
          if (field.type === "number") names.add("integer");
          else if (field.type === "boolean") names.add("boolean");
          else if (field.type === "date") names.add("timestamp");
          else if (field.type === "json") names.add("jsonb");
          else names.add("text");
          break;
        case "mysql":
          if (field.type === "number") names.add("int");
          else if (field.type === "boolean") names.add("boolean");
          else if (field.type === "date") names.add("datetime");
          else if (field.type === "json") names.add("json");
          else names.add("text");
          break;
        case "sqlite":
          if (field.type === "string" || field.type === "json") names.add("text");
          else names.add("integer");
          break;
      }
    }

    if (model.indexes && model.indexes.length > 0) {
      for (const idx of model.indexes) {
        if (idx.unique && idx.fields.length > 1) names.add("uniqueIndex");
        else if (!idx.unique) names.add("index");
      }
    }
  }

  const modulePath =
    provider === "pg"
      ? "drizzle-orm/pg-core"
      : provider === "mysql"
        ? "drizzle-orm/mysql-core"
        : "drizzle-orm/sqlite-core";

  return { modulePath, names: [...names].sort() };
}

// ─── topological sort ────────────────────────────────────────────────────────

function topoSort(schema: BmSchema): string[] {
  const deps: Record<string, Set<string>> = {};
  for (const [name, model] of Object.entries(schema)) {
    deps[name] = new Set();
    for (const field of Object.values(model.fields)) {
      if (field.references) deps[name]!.add(field.references.model);
    }
  }

  const sorted: string[] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    for (const dep of deps[name] ?? []) visit(dep);
    sorted.push(name);
  }

  for (const name of Object.keys(schema)) visit(name);
  return sorted;
}

// ─── table codegen ───────────────────────────────────────────────────────────

function tableFactoryName(provider: DrizzleProvider): string {
  return provider === "pg" ? "pgTable" : provider === "mysql" ? "mysqlTable" : "sqliteTable";
}

function generateTable(
  modelName: string,
  model: BmSchema[string],
  provider: DrizzleProvider
): string {
  const varName = modelVarName(modelName);
  const factory = tableFactoryName(provider);
  const lines: string[] = [];

  for (const [fieldName, field] of Object.entries(model.fields)) {
    lines.push(`  ${fieldName}: ${buildColChain(fieldName, field, provider)},`);
  }

  // Composite indexes in the third argument (single-field unique already handled inline)
  const compositeIndexes =
    model.indexes?.filter(
      (idx) => idx.fields.length > 1 || (idx.fields.length === 1 && !idx.unique)
    ) ?? [];

  if (compositeIndexes.length === 0) {
    return `export const ${varName} = ${factory}("${modelName}", {\n${lines.join("\n")}\n});`;
  }

  const idxLines = compositeIndexes.map((idx) => {
    const cols = idx.fields.map((f) => `t.${f}`).join(", ");
    const name = indexName(modelName, idx.fields);
    return idx.unique ? `  uniqueIndex("${name}").on(${cols}),` : `  index("${name}").on(${cols}),`;
  });

  return `export const ${varName} = ${factory}("${modelName}", {\n${lines.join("\n")}\n}, (t) => [\n${idxLines.join("\n")}\n]);`;
}

// ─── public API ──────────────────────────────────────────────────────────────

export function generateDrizzleSchema(schema: BmSchema, dialect: SqlDialect): string {
  const provider = dialectToProvider(dialect);
  const { modulePath, names } = collectImports(schema, provider);
  const order = topoSort(schema);

  const header = [
    `// Auto-generated by @better-media/cli — do not edit directly.`,
    `// Run "npx better-media generate --dialect ${dialect}" to regenerate.`,
    `// After editing, run "npx drizzle-kit generate" then "npx drizzle-kit migrate".`,
    ``,
    `import { ${names.join(", ")} } from "${modulePath}";`,
    ``,
  ].join("\n");

  const tables = order
    .map((name) => {
      const model = schema[name];
      if (!model) return "";
      return generateTable(name, model, provider);
    })
    .filter(Boolean)
    .join("\n\n");

  return header + tables + "\n";
}
