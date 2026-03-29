import type { DatabaseAdapter } from "./interfaces/adapter.interface";

export type QueryResultLike<T = unknown> = { rows: T[]; rowCount?: number | null };

export type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<QueryResultLike<Record<string, unknown>>>;
};

export type PgPoolLike = Queryable & {
  connect?: () => Promise<PgClientLike>;
};

export type PgClientLike = Queryable & {
  release?: () => void;
};

export function isPgPoolLike(value: unknown): value is PgPoolLike {
  return Boolean(
    value && typeof value === "object" && typeof (value as { query?: unknown }).query === "function"
  );
}

/**
 * Normalizes a database pool or adapter into a standard DatabaseAdapter.
 * Note: If using the built-in Postgres pool, this requires the actual
 * implementation to be registered or known.
 */
export function toDatabaseAdapter(
  database: DatabaseAdapter | PgPoolLike,
  postgresFactory?: (pool: PgPoolLike) => DatabaseAdapter
): DatabaseAdapter {
  if (isPgPoolLike(database) && typeof (database as { create?: unknown }).create !== "function") {
    if (postgresFactory) return postgresFactory(database);
    throw new Error(
      "[BetterMedia] Postgres pool detected but no adapter factory provided. " +
        "This typically means you should use the main @better-media/framework package."
    );
  }
  return database as DatabaseAdapter;
}
