import { KyselyDbAdapter, type KyselyDbOptions, type DbSchema } from "./kysely-db.adapter";
import type { DatabaseAdapter } from "@better-media/core";
import { Kysely, PostgresDialect, MysqlDialect, SqliteDialect } from "kysely";

export * from "./kysely-db-config.interface";
export * from "./kysely-db.adapter";

function isKyselyInstance(obj: unknown): obj is Kysely<DbSchema> {
  if (!obj || typeof obj !== "object") return false;
  const db = obj as Record<string, unknown>;
  return typeof db.selectFrom === "function" && typeof db.transaction === "function";
}

/**
 * Detects and wraps a raw database connection into a Kysely instance.
 */
function ensureKyselyInstance(
  db: unknown,
  options: KyselyDbOptions
): { db: Kysely<DbSchema>; provider: "pg" | "mysql" | "sqlite" } {
  if (isKyselyInstance(db)) {
    if (!options.config.provider) {
      throw new Error(
        "When providing a Kysely instance, 'options.config.provider' must be specified ('pg', 'mysql', or 'sqlite')."
      );
    }
    return { db, provider: options.config.provider };
  }

  const dbConnection = db as Record<string, unknown>;

  // Detect PostgreSQL (pg Pool)
  if (
    dbConnection &&
    typeof dbConnection.connect === "function" &&
    typeof dbConnection.query === "function"
  ) {
    return {
      db: new Kysely<DbSchema>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dialect: new PostgresDialect({ pool: dbConnection as any }),
      }),
      provider: "pg",
    };
  }

  // Detect MySQL (mysql2 Pool)
  if (
    dbConnection &&
    typeof dbConnection.getConnection === "function" &&
    typeof dbConnection.query === "function"
  ) {
    return {
      db: new Kysely<DbSchema>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dialect: new MysqlDialect({ pool: dbConnection as any }),
      }),
      provider: "mysql",
    };
  }

  // Detect SQLite (better-sqlite3)
  if (
    dbConnection &&
    typeof dbConnection.prepare === "function" &&
    typeof dbConnection.exec === "function"
  ) {
    return {
      db: new Kysely<DbSchema>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dialect: new SqliteDialect({ database: dbConnection as any }),
      }),
      provider: "sqlite",
    };
  }

  if (
    dbConnection &&
    typeof dbConnection.createAdapter === "function" &&
    typeof dbConnection.createQueryCompiler === "function"
  ) {
    if (!options.config.provider) {
      throw new Error(
        "When providing a Kysely Dialect, 'options.config.provider' must be specified for adapter behavior."
      );
    }
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: new Kysely<DbSchema>({ dialect: dbConnection as any }),
      provider: options.config.provider,
    };
  }

  throw new Error(
    "Unsupported database connection type. Please provide a Kysely instance, a pg/mysql2 Pool, or a better-sqlite3 Database."
  );
}

export function kyselyAdapter(
  db: Kysely<DbSchema> | unknown,
  options: KyselyDbOptions
): DatabaseAdapter {
  const { db: kyselyDb, provider } = ensureKyselyInstance(db, options);

  // Ensure provider is set in config for the adapter's internal logic
  options.config.provider = provider;

  const adapter = new KyselyDbAdapter(kyselyDb, options);
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      if (prop === "get") {
        return async (key: string) => {
          const res = await adapter.findOne({
            model: "legacy",
            where: [{ field: "id", value: key }],
          });
          return res;
        };
      }
      if (prop === "put") {
        return async (key: string, data: Record<string, unknown>) => {
          await adapter.create({ model: "legacy", data: { id: key, ...data } });
        };
      }
      if (prop === "delete") {
        return async (key: string) => {
          await adapter.delete({ model: "legacy", where: [{ field: "id", value: key }] });
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
