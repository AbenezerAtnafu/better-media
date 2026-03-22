import type { FieldType } from "./types";

export interface FieldConverter {
  serialize(value: unknown): unknown;
  deserialize(value: unknown): unknown;
}

export const converters: Record<FieldType, FieldConverter> = {
  json: {
    serialize: (value) => (value === undefined ? undefined : JSON.stringify(value)),
    deserialize: (value) => (typeof value === "string" ? JSON.parse(value) : value),
  },
  date: {
    serialize: (value) =>
      value instanceof Date ? value.toISOString() : typeof value === "string" ? value : value,
    deserialize: (value) => (typeof value === "string" ? new Date(value) : value),
  },
  boolean: {
    serialize: (value) => (typeof value === "boolean" ? (value ? 1 : 0) : value),
    deserialize: (value) => (typeof value === "number" ? value === 1 : Boolean(value)),
  },
  string: {
    serialize: (value) => value,
    deserialize: (value) => (typeof value === "number" ? String(value) : value),
  },
  number: {
    serialize: (value) => (typeof value === "string" ? Number(value) : value),
    deserialize: (value) => value,
  },
};

export function serializeField(type: FieldType, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  return converters[type]?.serialize(value) ?? value;
}

export function deserializeField(type: FieldType, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  return converters[type]?.deserialize(value) ?? value;
}

export function serializeData(
  fields: Record<string, { type: FieldType }>,
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (fields[key]) {
      result[key] = serializeField(fields[key].type, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function deserializeData(
  fields: Record<string, { type: FieldType }>,
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (fields[key]) {
      result[key] = deserializeField(fields[key].type, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
