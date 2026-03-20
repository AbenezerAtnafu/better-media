declare module "mongodb" {
  export type MongoClient = {
    db(name: string): Db;
    startSession(): ClientSession;
  };
  export type Db = {
    collection<T = Document>(name: string): Collection<T>;
    listCollections(filter?: Record<string, unknown>): { toArray(): Promise<unknown[]> };
    createCollection(name: string): Promise<void>;
    databaseName: string;
  };
  export type Collection<T = Document> = {
    insertOne(doc: T, options?: { session?: ClientSession }): Promise<void>;
    findOne(
      filter: Record<string, unknown>,
      options?: { projection?: Record<string, number>; session?: ClientSession }
    ): Promise<T | null>;
    find(filter: Record<string, unknown>, options?: { session?: ClientSession }): FindCursor<T>;
    updateOne(
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options?: { session?: ClientSession }
    ): Promise<void>;
    updateMany(
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options?: { session?: ClientSession }
    ): Promise<{ modifiedCount: number }>;
    deleteOne(
      filter: Record<string, unknown>,
      options?: { session?: ClientSession }
    ): Promise<void>;
    deleteMany(
      filter: Record<string, unknown>,
      options?: { session?: ClientSession }
    ): Promise<{ deletedCount: number }>;
    countDocuments(
      filter: Record<string, unknown>,
      options?: { session?: ClientSession }
    ): Promise<number>;
    createIndex(keys: Record<string, number>, options?: { unique?: boolean }): Promise<void>;
  };

  export type FindCursor<T> = {
    project(p: Record<string, number>): FindCursor<T>;
    sort(s: Record<string, number>): FindCursor<T>;
    skip(s: number): FindCursor<T>;
    limit(l: number): FindCursor<T>;
    toArray(): Promise<T[]>;
  };

  export type Document = Record<string, unknown>;
  export type Filter<T = Document> = Partial<T> | Record<string, unknown> | { _unused?: T };
  export type UpdateFilter = Record<string, unknown>;
  export interface ClientSession {
    withTransaction(callback: () => Promise<unknown>): Promise<unknown>;
    endSession(): Promise<void>;
  }
}
