import type {
  WhereClause,
  CreateOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  CountOptions,
  DatabaseAdapter,
  DatabaseTransactionAdapter,
} from "@better-media/core";

export type {
  WhereClause,
  CreateOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  CountOptions,
  DatabaseAdapter,
  DatabaseTransactionAdapter,
};

export type FieldType = "string" | "number" | "boolean" | "date" | "json";

export interface FieldDefinition {
  type: FieldType;
  /** Whether this field is the primary key */
  primaryKey?: boolean;
  /** Whether this field must always have a value */
  required?: boolean;
  /** Whether the values in this field must be unique across the table */
  unique?: boolean;
  /** Default value for new records */
  defaultValue?: unknown | (() => unknown);
  /** Foreign key reference */
  references?: {
    model: string;
    field: string;
    onDelete?: "cascade" | "set null" | "restrict";
  };
}

export interface IndexDefinition {
  fields: string[];
  unique?: boolean;
}

export interface ModelDefinition {
  fields: Record<string, FieldDefinition>;
  indexes?: IndexDefinition[];
  /** Whether to enable soft delete for this model */
  softDelete?: boolean;
}

export type BmSchema = Record<string, ModelDefinition>;

/**
 * Context passed to database hooks.
 */
export interface HookContext {
  model: string;
  adapter: DatabaseAdapter;
  transaction?: DatabaseTransactionAdapter;
}

export type HookHandler<T = unknown, R = unknown> = (data: T, context: HookContext) => Promise<R>;

export interface DbHooks {
  before?: {
    create?: HookHandler<Record<string, unknown>, Record<string, unknown>>[];
    update?: HookHandler<Record<string, unknown>, Record<string, unknown>>[];
    delete?: HookHandler<WhereClause, void>[];
  };
  after?: {
    create?: HookHandler<Record<string, unknown>, void>[];
    update?: HookHandler<Record<string, unknown>, void>[];
    delete?: HookHandler<WhereClause, void>[];
  };
}
