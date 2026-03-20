import type { WhereClause } from "./types";

/**
 * Type-safe lifecycle hooks that run before and after database operations.
 * Use these to inject application logic (e.g., audit logging, event emission)
 * without modifying the generic database adapters.
 */
export interface DbHooks {
  before?: {
    create?: (model: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
    update?: (model: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
    delete?: (model: string, where: WhereClause) => Promise<void>;
  };
  after?: {
    create?: (model: string, result: Record<string, unknown>) => Promise<void>;
    update?: (model: string, result: Record<string, unknown>) => Promise<void>;
    delete?: (model: string, where: WhereClause) => Promise<void>;
  };
}

/**
 * Utility to run hooks sequentially
 */
export const runHooks = {
  async beforeCreate(hooks: DbHooks | undefined, model: string, data: Record<string, unknown>) {
    if (hooks?.before?.create) {
      return hooks.before.create(model, data);
    }
    return data;
  },

  async beforeUpdate(hooks: DbHooks | undefined, model: string, data: Record<string, unknown>) {
    if (hooks?.before?.update) {
      return hooks.before.update(model, data);
    }
    return data;
  },

  async beforeDelete(hooks: DbHooks | undefined, model: string, where: WhereClause) {
    if (hooks?.before?.delete) {
      await hooks.before.delete(model, where);
    }
  },

  async afterCreate(hooks: DbHooks | undefined, model: string, result: Record<string, unknown>) {
    if (hooks?.after?.create) {
      await hooks.after.create(model, result);
    }
  },

  async afterUpdate(hooks: DbHooks | undefined, model: string, result: Record<string, unknown>) {
    if (hooks?.after?.update) {
      await hooks.after.update(model, result);
    }
  },

  async afterDelete(hooks: DbHooks | undefined, model: string, where: WhereClause) {
    if (hooks?.after?.delete) {
      await hooks.after.delete(model, where);
    }
  },
};
