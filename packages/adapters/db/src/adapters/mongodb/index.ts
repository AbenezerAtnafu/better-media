/**
 * MongoDB adapter — implementation lives in @better-media/mongodb-adapter.
 * Re-exported here so @better-media/adapter-db remains a convenience
 * single-package install for users who want all adapters.
 */
export { MongoDbAdapter, mongodbAdapter } from "@better-media/mongodb-adapter";
export type { MongoDbConfig, MongoDbOptions } from "@better-media/mongodb-adapter";
