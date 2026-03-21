import type {
  DatabaseAdapter,
  DatabaseTransactionAdapter,
  WhereClause,
  CreateOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  CountOptions,
} from "@better-media/core";
import type { DbHooks, BmSchema, FieldType, ModelDefinition, HookContext } from "better-media";
import { runHooks, serializeData, deserializeData } from "better-media";

export interface MemoryDbOptions {
  schema?: BmSchema;
  hooks?: DbHooks;
}

/**
 * In-memory database adapter for development and testing.
 */
export class MemoryDbAdapter implements DatabaseAdapter {
  private readonly store = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly schema?: BmSchema;
  private readonly hooks?: DbHooks;

  constructor(options?: MemoryDbOptions) {
    this.schema = options?.schema;
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

  private getModelFields(model: string): Record<string, { type: FieldType }> {
    return this.schema?.[model]?.fields ?? {};
  }

  private getModelDefinition(model: string): ModelDefinition | undefined {
    return this.schema?.[model];
  }

  private getHookContext(model: string, trx?: DatabaseTransactionAdapter): HookContext {
    return {
      model,
      adapter: this,
      transaction: trx,
    };
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
      case "not_in":
        return Array.isArray(targetValue) && !targetValue.includes(recordValue);
      case "contains":
        return typeof recordValue === "string" && recordValue.includes(String(targetValue));
      case "starts_with":
        return String(recordValue).toLowerCase().startsWith(String(targetValue).toLowerCase());
      case "ends_with":
        return String(recordValue).toLowerCase().endsWith(String(targetValue).toLowerCase());
      case "like":
        return (
          typeof recordValue === "string" &&
          recordValue.toLowerCase().includes(String(targetValue).toLowerCase())
        );
      case "=":
      default:
        return recordValue === targetValue;
    }
  }

  private matchesWhere(
    record: Record<string, unknown>,
    where?: WhereClause,
    model?: string,
    options?: { withDeleted?: boolean }
  ): boolean {
    const definition = model ? this.getModelDefinition(model) : undefined;

    // Soft delete filtering
    if (definition?.softDelete && !options?.withDeleted) {
      if (record.deletedAt !== null && record.deletedAt !== undefined) return false;
    }

    if (!where || where.length === 0) return true;

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
    const fields = this.getModelFields(options.model);
    const context = this.getHookContext(options.model);

    let dataToInsert = options.data as Record<string, unknown>;
    dataToInsert = await runHooks.beforeCreate(this.hooks, dataToInsert, context);

    if (!dataToInsert.id) {
      throw new Error("MemoryDbAdapter requires 'id' in data for create operations");
    }

    const serializedData = serializeData(fields, dataToInsert);
    const clonedData = JSON.parse(JSON.stringify(serializedData));
    table.set(String(clonedData.id), clonedData);

    const resultRecord = deserializeData(fields, clonedData) as T;
    await runHooks.afterCreate(this.hooks, resultRecord as Record<string, unknown>, context);
    return resultRecord;
  }

  private populateRecord(
    record: Record<string, unknown>,
    model: string,
    populate: string[]
  ): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(record));
    const sortedPopulate = [...populate].sort((a, b) => a.split(".").length - b.split(".").length);

    for (const path of sortedPopulate) {
      const parts = path.split(".");
      let currentObj = result;
      let currentModel = model;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const fieldDef = this.schema?.[currentModel]?.fields[part];

        if (fieldDef?.references) {
          const relatedTable = this.getTable(fieldDef.references.model);
          const localValue = currentObj[part];
          if (localValue === undefined || localValue === null) break;

          // If already populated (e.g. by a previous path segment), use that
          const relatedId = typeof localValue === "object" ? localValue.id : localValue;
          const relatedRecord = relatedTable.get(String(relatedId));

          if (relatedRecord) {
            currentObj[part] = JSON.parse(JSON.stringify(relatedRecord));
            currentModel = fieldDef.references.model;
            currentObj = currentObj[part];
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }
    return result;
  }

  async findOne<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T | null> {
    const table = this.getTable(options.model);
    const fields = this.getModelFields(options.model);

    for (const record of table.values()) {
      if (
        this.matchesWhere(record, options.where, options.model, {
          withDeleted: options.withDeleted,
        })
      ) {
        let result = record;
        if (options.populate) {
          result = this.populateRecord(record, options.model, options.populate);
        }
        return deserializeData(fields, JSON.parse(JSON.stringify(result))) as T;
      }
    }
    return null;
  }

  async findMany<T extends Record<string, unknown>>(options: FindOptions<T>): Promise<T[]> {
    const table = this.getTable(options.model);
    let results: T[] = [];

    for (const record of table.values()) {
      if (
        this.matchesWhere(record, options.where, options.model, {
          withDeleted: options.withDeleted,
        })
      ) {
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

    if (options.offset) results = results.slice(options.offset);
    if (options.limit) results = results.slice(0, options.limit);

    return results;
  }

  async update<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<T | null> {
    const table = this.getTable(options.model);
    const fields = this.getModelFields(options.model);
    const context = this.getHookContext(options.model);

    const target = await this.findOne({ model: options.model, where: options.where });
    if (!target) return null;

    let updatedData = { ...target, ...(options.update as Record<string, unknown>) };
    updatedData = await runHooks.beforeUpdate(this.hooks, updatedData, context);

    const serializedUpdate = serializeData(fields, updatedData);
    const mergedData = { ...target, ...serializedUpdate };

    const clonedData = JSON.parse(JSON.stringify(mergedData));
    table.set(String(target.id), clonedData);

    const resultRecord = deserializeData(fields, clonedData) as T;
    await runHooks.afterUpdate(this.hooks, resultRecord as Record<string, unknown>, context);
    return resultRecord;
  }

  async updateMany<T extends Record<string, unknown>>(options: UpdateOptions<T>): Promise<number> {
    const targets = await this.findMany({ model: options.model, where: options.where });
    for (const target of targets) {
      await this.update({
        model: options.model,
        where: [{ field: "id", value: target.id }],
        update: options.update,
      });
    }
    return targets.length;
  }

  async delete(options: DeleteOptions): Promise<void> {
    const context = this.getHookContext(options.model);
    const definition = this.getModelDefinition(options.model);

    await runHooks.beforeDelete(this.hooks, options.where, context);

    if (definition?.softDelete) {
      await this.updateMany({
        model: options.model,
        where: options.where,
        update: { deletedAt: new Date() } as unknown as Record<string, unknown>,
      });
    } else {
      const table = this.getTable(options.model);
      const targets = await this.findMany({ model: options.model, where: options.where });
      for (const target of targets) {
        table.delete(String(target.id));
      }
    }

    await runHooks.afterDelete(this.hooks, options.where, context);
  }

  async deleteMany(options: DeleteOptions): Promise<number> {
    const targets = await this.findMany({ model: options.model, where: options.where });
    await this.delete(options);
    return targets.length;
  }

  async count(options: CountOptions): Promise<number> {
    const results = await this.findMany({ ...options, limit: undefined, offset: undefined });
    return results.length;
  }

  clear(): void {
    this.store.clear();
  }

  async raw<T = unknown>(query: string): Promise<T> {
    if (query === "clear") {
      this.clear();
      return true as unknown as T;
    }
    throw new Error("MemoryDbAdapter only supports 'clear' as raw query.");
  }

  async transaction<R>(callback: (trx: DatabaseTransactionAdapter) => Promise<R>): Promise<R> {
    return await callback(this as unknown as DatabaseTransactionAdapter);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getMetadata(): Promise<any[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata: any[] = [];
    for (const [tableName, table] of this.store.entries()) {
      const columns = new Set<string>();
      // Infer columns from existing data
      for (const record of table.values()) {
        Object.keys(record).forEach((k) => columns.add(k));
      }
      metadata.push({
        name: tableName,
        columns: Array.from(columns).map((name) => ({
          name,
          dataType: "text", // Memory storage is type-agnostic
          isNullable: true,
        })),
      });
    }
    return metadata;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async executeMigration(operation: any): Promise<void> {
    if (operation.type === "createTable") {
      this.getTable(operation.table);
    }
    // Other operations are implicitly handled by the schemaless nature of MemoryDbAdapter
  }

  /**
   * @deprecated Use executeMigration instead.
   */
  async __initTable(
    model: string,
    definition: ModelDefinition,
    options: { mode: "safe" | "diff" | "force" }
  ): Promise<void> {
    if (options.mode === "force") {
      this.store.delete(model);
    }
    this.getTable(model);
  }
}
