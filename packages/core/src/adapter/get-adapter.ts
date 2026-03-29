import type { DatabaseAdapter } from "../database/interfaces/adapter.interface";
import { toDatabaseAdapter, type PgPoolLike } from "../database/postgres-utils";

export type GetAdapterOptions = {
  database?: DatabaseAdapter | PgPoolLike;
  createDatabase?: () => Promise<DatabaseAdapter | PgPoolLike> | DatabaseAdapter | PgPoolLike;
  dialect?: string;
  schemaOutput?: string;
  migrationsDir?: string;
};

export async function getAdapter(options: GetAdapterOptions): Promise<DatabaseAdapter> {
  const database = options.database ?? (await options.createDatabase?.());
  const adapter = database ? toDatabaseAdapter(database) : undefined;
  if (!adapter) {
    throw new Error(
      `[media] Failed to initialize database adapter. Provide "database" or "createDatabase()".`
    );
  }
  return adapter;
}
