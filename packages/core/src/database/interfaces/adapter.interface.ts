// ---------------------------------------------------------------------------
// Where clause – one or more field conditions
// ---------------------------------------------------------------------------
export type WhereClause = {
  field: string;
  value: unknown;
  operator?:
    | "="
    | "!="
    | "<"
    | "<="
    | ">"
    | ">="
    | "like"
    | "in"
    | "not_in"
    | "contains"
    | "starts_with"
    | "ends_with";
  connector?: "AND" | "OR";
}[];

// ---------------------------------------------------------------------------
// Operation option bags
// ---------------------------------------------------------------------------
export interface CreateOptions<T = Record<string, unknown>> {
  /** Table / collection name */
  model: string;
  /** Data to insert */
  data: T;
}

export interface FindOptions<T = Record<string, unknown>> {
  /** Table / collection name */
  model: string;
  /** Filter conditions – combined with AND by default */
  where?: WhereClause;
  /** Fields to return; omit to return all */
  select?: (keyof T & string)[];
  /** Sort order */
  sortBy?: { field: string; direction: "asc" | "desc" };
  /** Maximum number of records to return */
  limit?: number;
  /** Number of records to skip */
  offset?: number;
  /** Include soft-deleted records if true */
  withDeleted?: boolean;
  /** Relationships to populate (join/fetch) */
  populate?: string[];
}

export interface UpdateOptions<T = Record<string, unknown>> {
  /** Table / collection name */
  model: string;
  /** Filter conditions that identify the record(s) to update */
  where: WhereClause;
  /** Partial data to merge into the matched record(s) */
  update: Partial<T>;
}

export interface DeleteOptions {
  /** Table / collection name */
  model: string;
  /** Filter conditions that identify the record(s) to delete */
  where: WhereClause;
}

export interface CountOptions {
  /** Table / collection name */
  model: string;
  /** Filter conditions */
  where?: WhereClause;
}

// ---------------------------------------------------------------------------
// DatabaseAdapter
// ---------------------------------------------------------------------------

/**
 * Adapter specifically for transaction contexts, omitting the ability to nest transactions.
 */
export type DatabaseTransactionAdapter = Omit<DatabaseAdapter, "transaction">;

/**
 * Engine-agnostic database adapter interface.
 */
export interface DatabaseAdapter {
  /**
   * Insert a new record and return the persisted result (including any
   * server-side defaults such as `id`, `createdAt`, etc.).
   */
  create<T extends Record<string, unknown> = Record<string, unknown>>(
    options: CreateOptions<T>
  ): Promise<T>;

  /**
   * Return the first record matching `where`, or `null` if no match.
   */
  findOne<T extends Record<string, unknown> = Record<string, unknown>>(
    options: FindOptions<T>
  ): Promise<T | null>;

  /**
   * Return all records matching `where`. Returns an empty array when there
   * are no matches.
   */
  findMany<T extends Record<string, unknown> = Record<string, unknown>>(
    options: FindOptions<T>
  ): Promise<T[]>;

  /**
   * Apply a partial update to all records matching `where` and return the
   * first updated record, or `null` if no match was found.
   */
  update<T extends Record<string, unknown> = Record<string, unknown>>(
    options: UpdateOptions<T>
  ): Promise<T | null>;

  /**
   * Apply a partial update to all records matching `where` and return the
   * number of updated records.
   */
  updateMany<T extends Record<string, unknown> = Record<string, unknown>>(
    options: UpdateOptions<T>
  ): Promise<number>;

  /**
   * Delete all records matching `where`.
   */
  delete(options: DeleteOptions): Promise<void>;

  /**
   * Delete all records matching `where` and return the number of deleted records.
   */
  deleteMany(options: DeleteOptions): Promise<number>;

  /**
   * Return the number of records matching `where`.
   */
  count(options: CountOptions): Promise<number>;

  /**
   * Execute a raw query. USE WITH CAUTION.
   * This breaks engine-agnosticism.
   */
  raw<T = unknown>(query: string, params?: unknown[]): Promise<T>;

  /**
   * Execute multiple operations within an atomic transaction.
   */
  transaction<R>(callback: (trx: DatabaseTransactionAdapter) => Promise<R>): Promise<R>;
}
