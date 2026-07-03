"use client";

import { useState } from "react";
import { Database } from "lucide-react";

interface DatabaseField {
  name: string;
  type: string;
  description: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isOptional?: boolean;
}

interface DatabaseTableProps {
  name: string;
  fields: DatabaseField[];
}

type SqlDialect = "postgresql" | "mysql" | "sqlite" | "mssql";

const DIALECT_LABELS: Record<SqlDialect, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mssql: "MSSQL",
};

function toSqlType(type: string, dialect: SqlDialect): string {
  const t = type.toLowerCase().replace(/['"]/g, "");
  if (t === "boolean") {
    if (dialect === "postgresql") return "BOOLEAN";
    if (dialect === "mysql") return "TINYINT(1)";
    if (dialect === "sqlite") return "INTEGER";
    if (dialect === "mssql") return "BIT";
  }
  if (t === "number") {
    if (dialect === "mssql") return "INT";
    return "INTEGER";
  }
  if (t === "date") {
    if (dialect === "postgresql") return "TIMESTAMP";
    if (dialect === "mysql") return "DATETIME";
    if (dialect === "sqlite") return "TEXT";
    if (dialect === "mssql") return "DATETIME2";
  }
  // string or string literal types
  if (dialect === "postgresql") return "TEXT";
  if (dialect === "mysql") return "VARCHAR(255)";
  if (dialect === "sqlite") return "TEXT";
  if (dialect === "mssql") return "NVARCHAR(255)";
  return "TEXT";
}

function quoteIdentifier(name: string, dialect: SqlDialect): string {
  if (dialect === "mssql") return `[${name}]`;
  if (dialect === "mysql") return `\`${name}\``;
  return `"${name}"`;
}

function generateSql(tableName: string, fields: DatabaseField[], dialect: SqlDialect): string {
  const q = (n: string) => quoteIdentifier(n, dialect);
  const lines = fields.map((f) => {
    const sqlType = toSqlType(f.type, dialect);
    const nullable = f.isPrimaryKey || !f.isOptional ? " NOT NULL" : "";
    return `  ${q(f.name)} ${sqlType}${nullable}`;
  });
  const pk = fields.find((f) => f.isPrimaryKey);
  if (pk) lines.push(`  PRIMARY KEY (${q(pk.name)})`);
  return `CREATE TABLE ${q(tableName)} (\n${lines.join(",\n")}\n);`;
}

export function DatabaseTable({ name, fields }: DatabaseTableProps) {
  const [view, setView] = useState<"table" | "sql">("table");
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");

  return (
    <div className="my-4 rounded-lg border border-fd-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-fd-border bg-fd-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Database className="size-3.5 text-fd-muted-foreground" />
          <span className="font-mono text-xs font-semibold text-fd-foreground">{name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(["table", "sql"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-1 capitalize transition-colors border-b-2 ${
                view === v
                  ? "border-fd-foreground text-fd-foreground font-medium"
                  : "border-transparent text-fd-muted-foreground hover:text-fd-foreground"
              }`}
            >
              {v === "sql" ? "SQL" : "Table"}
            </button>
          ))}
        </div>
      </div>

      {/* Table view */}
      {view === "table" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fd-border bg-fd-muted/50">
              <th className="px-4 py-2.5 text-left font-medium text-fd-muted-foreground">Field</th>
              <th className="px-4 py-2.5 text-left font-medium text-fd-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-left font-medium text-fd-muted-foreground">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => (
              <tr key={field.name} className={i % 2 === 0 ? "bg-fd-background" : "bg-fd-muted/20"}>
                <td className="px-4 py-2.5 font-mono text-xs">
                  <span className="text-fd-foreground">{field.name}</span>
                  {field.isPrimaryKey && (
                    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-sans font-medium text-amber-600 dark:text-amber-400">
                      PK
                    </span>
                  )}
                  {field.isForeignKey && (
                    <span className="ml-2 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-sans font-medium text-blue-600 dark:text-blue-400">
                      FK
                    </span>
                  )}
                  {field.isOptional && (
                    <span className="ml-2 rounded bg-fd-muted px-1.5 py-0.5 text-[10px] font-sans font-medium text-fd-muted-foreground">
                      optional
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-fd-primary">{field.type}</td>
                <td className="px-4 py-2.5 text-fd-muted-foreground">{field.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* SQL view */}
      {view === "sql" && (
        <div>
          <div className="flex gap-1 border-b border-fd-border bg-fd-muted/20 px-3 py-1">
            {(Object.keys(DIALECT_LABELS) as SqlDialect[]).map((d) => (
              <button
                key={d}
                onClick={() => setDialect(d)}
                className={`px-2 py-1 text-xs transition-colors border-b-2 ${
                  dialect === d
                    ? "border-fd-foreground text-fd-foreground font-medium"
                    : "border-transparent text-fd-muted-foreground hover:text-fd-foreground"
                }`}
              >
                {DIALECT_LABELS[d]}
              </button>
            ))}
          </div>
          <pre className="overflow-x-auto bg-fd-background p-4 text-xs leading-relaxed text-fd-foreground">
            <code>{generateSql(name, fields, dialect)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
