import type {
  WhereClause,
  CreateOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  CountOptions,
} from "@better-media/core";

export type { WhereClause, CreateOptions, FindOptions, UpdateOptions, DeleteOptions, CountOptions };

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

export interface ModelDefinition {
  fields: Record<string, FieldDefinition>;
}

export type BmSchema = Record<string, ModelDefinition>;
