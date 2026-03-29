import type { WhereClause, DbHooks, DatabaseHookContext } from "./types";

/**
 * Utility to run hooks sequentially.
 * Supports multiple handlers and passes DatabaseHookContext.
 */
export const runHooks = {
  async beforeCreate(
    hooks: DbHooks | undefined,
    data: Record<string, unknown>,
    context: DatabaseHookContext
  ) {
    let currentData = data;
    const handlers = hooks?.before?.create || [];
    for (const handler of handlers) {
      currentData = await handler(currentData, context);
    }
    return currentData;
  },

  async beforeUpdate(
    hooks: DbHooks | undefined,
    data: Record<string, unknown>,
    context: DatabaseHookContext
  ) {
    let currentData = data;
    const handlers = hooks?.before?.update || [];
    for (const handler of handlers) {
      currentData = await handler(currentData, context);
    }
    return currentData;
  },

  async beforeDelete(hooks: DbHooks | undefined, where: WhereClause, context: DatabaseHookContext) {
    const handlers = hooks?.before?.delete || [];
    for (const handler of handlers) {
      await handler(where, context);
    }
  },

  async afterCreate(
    hooks: DbHooks | undefined,
    result: Record<string, unknown>,
    context: DatabaseHookContext
  ) {
    const handlers = hooks?.after?.create || [];
    for (const handler of handlers) {
      await handler(result, context);
    }
  },

  async afterUpdate(
    hooks: DbHooks | undefined,
    result: Record<string, unknown>,
    context: DatabaseHookContext
  ) {
    const handlers = hooks?.after?.update || [];
    for (const handler of handlers) {
      await handler(result, context);
    }
  },

  async afterDelete(hooks: DbHooks | undefined, where: WhereClause, context: DatabaseHookContext) {
    const handlers = hooks?.after?.delete || [];
    for (const handler of handlers) {
      await handler(where, context);
    }
  },
};
