import { runMigrations } from "./migration";
import type { DatabaseAdapter } from "@better-media/core";
import { schema } from "./schema";

interface MockDatabaseAdapter extends DatabaseAdapter {
  __createTable?: jest.Mock;
  __initCollection?: jest.Mock;
}

describe("runMigrations", () => {
  it("should warn and do nothing if adapter lacks migration methods", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
    const mockMemoryAdapter = {
      create: jest.fn(),
      findOne: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      transaction: jest.fn(),
    } as unknown as MockDatabaseAdapter;

    await runMigrations(mockMemoryAdapter);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[BetterMedia] Adapter does not support automatic migrations."
    );

    consoleSpy.mockRestore();
  });

  it("should call __createTable for SQL adapters", async () => {
    const mockSqlAdapter = {
      __createTable: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
      findOne: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      transaction: jest.fn(),
    } as unknown as MockDatabaseAdapter;

    await runMigrations(mockSqlAdapter);

    // It should be called for every model in the schema
    const models = Object.keys(schema);
    expect(mockSqlAdapter.__createTable).toHaveBeenCalledTimes(models.length);

    // Check one specific call
    expect(mockSqlAdapter.__createTable).toHaveBeenCalledWith("media", schema["media"]);
  });

  it("should call __initCollection for MongoDB adapters", async () => {
    const mockMongoAdapter = {
      __initCollection: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
      findOne: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      transaction: jest.fn(),
    } as unknown as MockDatabaseAdapter;

    await runMigrations(mockMongoAdapter);

    const models = Object.keys(schema);
    expect(mockMongoAdapter.__initCollection).toHaveBeenCalledTimes(models.length);

    expect(mockMongoAdapter.__initCollection).toHaveBeenCalledWith("media", schema["media"]);
  });
});
