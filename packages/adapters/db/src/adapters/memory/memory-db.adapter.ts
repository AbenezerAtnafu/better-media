import type {
  DatabaseAdapter,
  WhereClause,
  CreateOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  CountOptions,
} from "@better-media/core";
import type { DbHooks } from "better-media";
import { runHooks } from "better-media";

export interface MemoryDbOptions {
  hooks?: DbHooks;
}

/**
 * In-memory database adapter for development and testing.
 * Implements the full CRUD interface but data is lost when the process exits.
 */
export class MemoryDbAdapter implements DatabaseAdapter {
  // Map<ModelName, Map<Id, Record>>
  private readonly store = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly hooks?: DbHooks;

  constructor(options?: MemoryDbOptions) {
    this.hooks = options?.hooks;
  }

  private getTable(model: string): Map<string, Record<string, unknown>> {
    let table = this.store.get(model);
    if (!table) {
      table = new Map();
      this.store.set(model, table);
    }
    return table;
  }

  private matchCondition(record: Record<string, unknown>, condition: WhereClause[number]): boolean {
    const recordValue = record[condition.field];
    const targetValue = condition.value;

    switch (condition.operator) {
      case "!=":
        return recordValue !== targetValue;
      case "<":
        return Number(recordValue) < Number(targetValue);
      case "<=":
        return Number(recordValue) <= Number(targetValue);
      case ">":
        return Number(recordValue) > Number(targetValue);
      case ">=":
        return Number(recordValue) >= Number(targetValue);
      case "in":
        return Array.isArray(targetValue) && targetValue.includes(recordValue);
      case "contains":
        return typeof recordValue === "string" && recordValue.includes(String(targetValue));
      case "like":
        // Simple case-insensitive contains for memory adapter
        return (
          typeof recordValue === "string" &&
          recordValue.toLowerCase().includes(String(targetValue).toLowerCase())
        );
      case "not_in":
        return Array.isArray(targetValue) && !targetValue.includes(recordValue);
      case "starts_with":
        return String(recordValue).toLowerCase().startsWith(String(targetValue).toLowerCase());
      case "ends_with":
        return String(recordValue).toLowerCase().endsWith(String(targetValue).toLowerCase());
      case "=":
      default:
        return recordValue === targetValue;
    }
  }

  private matchesWhere(record: Record<string, unknown>, where?: WhereClause): boolean {
    if (!where || where.length === 0) return true;

    // We process sequentially. For a robust implementation we'd build an AST,
    // but memory adapter is for testing. We assume AND connections by default.
    let isMatch = true;

    for (let i = 0; i < where.length; i++) {
      const condition = where[i]!;
      const connector = i > 0 ? (where[i - 1]?.connector ?? "AND") : "AND";
      const conditionMatches = this.matchCondition(record, condition);

      if (connector === "OR") {
        isMatch = isMatch || conditionMatches;
      } else {
        isMatch = isMatch && conditionMatches;
      }
    }

    return isMatch;
  }

  async create<T extends Record<string, unknown>>(options: CreateOptions<T>): Promise<T> {
    const table = this.getTable(options.model);
    let dataToInsert = options.data as Record<string, unknown>;

    // Type casting here since we know our models use 'id'
    if (!dataToInsert.id) {
      throw new Error("MemoryDbAdapter requires 'id' in data for create operations");
    }

    dataToInsert = await runHooks.beforeCreate(this.hooks, options.model, dataToInsert);

    // Deep clone to prevent reference mutations
    const clonedData = JSON.parse(JSON.stringify(dataToInsert));
    table.set(String(clonedData.id), clonedData);

    await runHooks.afterCreate(this.hooks, options.model, clonedData);

    return clonedData as T;
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const table = this.getTable(options.model);

    // Fast path: if 'where' is just finding by ID
    if (
      options.where?.length === 1 &&
      options.where[0]?.field === "id" &&
      options.where[0]?.operator !== "!="
    ) {
      const record = table.get(String(options.where[0]?.value));
      return record ? (JSON.parse(JSON.stringify(record)) as T) : null;
    }

    // Slow path: scan
    for (const record of table.values()) {
      if (this.matchesWhere(record, options.where)) {
        return JSON.parse(JSON.stringify(record)) as T;
      }
    }

    return null;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const table = this.getTable(options.model);
    let results: T[] = [];

    for (const record of table.values()) {
      if (this.matchesWhere(record, options.where)) {
        results.push(JSON.parse(JSON.stringify(record)) as T);
      }
    }

    if (options.sortBy) {
      const { field, direction } = options.sortBy;
      results.sort((a, b) => {
        const valA = a[field] as string | number;
        const valB = b[field] as string | number;
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const table = this.getTable(options.model);
    let targetId: string | undefined;
    let targetRecord: Record<string, unknown> | undefined;

    // Fast path ID lookup
    if (
      options.where?.length === 1 &&
      options.where[0]?.field === "id" &&
      options.where[0]?.operator !== "!="
    ) {
      targetId = String(options.where[0]?.value);
      targetRecord = table.get(targetId);
    } else {
      for (const record of table.values()) {
        if (this.matchesWhere(record, options.where)) {
          targetRecord = record;
          targetId = String(record.id);
          break; // Update only first match (per findOne semantics for update)
        }
      }
    }

    if (!targetRecord || !targetId) return null;

    let updatedData = { ...targetRecord, ...(options.update as Record<string, unknown>) };
    updatedData = await runHooks.beforeUpdate(this.hooks, options.model, updatedData);

    const clonedData = JSON.parse(JSON.stringify(updatedData));
    // The original code had `const resultRecord = deserializeData(fields, serializeData(fields, updatedData)) as T;`
    // but `fields` is not defined here. Assuming the intent was to return the cloned data.
    // If `fields` were available, this would be the correct way to handle serialization.
    table.set(targetId, clonedData);

    await runHooks.afterUpdate(this.hooks, options.model, clonedData);

    return clonedData as T;
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const targets = await this.findMany({ model: options.model, where: options.where });
    let count = 0;
    for (const target of targets) {
      await this.update({
        model: options.model,
        where: [{ field: "id", value: target.id }],
        update: options.update,
      });
      count++;
    }
    return count;
  }

  async delete(options: DeleteOptions): Promise<void> {
    const table = this.getTable(options.model);

    await runHooks.beforeDelete(this.hooks, options.model, options.where);

    if (
      options.where?.length === 1 &&
      options.where[0]?.field === "id" &&
      options.where[0]?.operator !== "!="
    ) {
      table.delete(String(options.where[0]?.value));
    } else {
      const idsToDelete: string[] = [];
      for (const record of table.values()) {
        if (this.matchesWhere(record, options.where)) {
          idsToDelete.push(String(record.id));
        }
      }
      for (const id of idsToDelete) {
        table.delete(id);
      }
    }

    await runHooks.afterDelete(this.hooks, options.model, options.where);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    const targets = await this.findMany({ model: options.model, where: options.where });
    let count = 0;
    for (const target of targets) {
      await this.delete({
        model: options.model,
        where: [{ field: "id", value: target.id }],
      });
      count++;
    }
    return count;
  }

  async count(options: CountOptions): Promise<number> {
    const table = this.getTable(options.model);

    if (!options.where || options.where.length === 0) {
      return table.size;
    }

    let count = 0;
    for (const record of table.values()) {
      if (this.matchesWhere(record, options.where)) {
        count++;
      }
    }
    return count;
  }

  async transaction<R>(callback: (trx: DatabaseAdapter) => Promise<R>): Promise<R> {
    return await callback(this);
  }

  /** Clears all data - useful for resetting state between tests */
  clear() {
    this.store.clear();
  }
}
