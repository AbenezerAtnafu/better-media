import type { MongoClient } from "mongodb";
import { MongoDbAdapter } from "./mongodb-db.adapter";

describe("MongoDbAdapter", () => {
  let adapter: MongoDbAdapter;
  let mockClient: Record<string, unknown>;
  let mockDb: Record<string, unknown>;
  let mockCollection: Record<string, unknown>;

  beforeEach(() => {
    mockCollection = {
      insertOne: jest.fn().mockResolvedValue({ insertedId: "123" }),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockReturnValue({
        project: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([]),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
      countDocuments: jest.fn().mockResolvedValue(0),
      createIndex: jest.fn().mockResolvedValue("index_name"),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      listCollections: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      }),
      createCollection: jest.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      db: jest.fn().mockReturnValue(mockDb),
    };

    adapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
      config: { databaseName: "test_db" },
      schema: { users: { fields: {} } },
    });
  });

  it("should create a record and map id", async () => {
    const data = { id: "123", name: "Test User" };
    const result = await adapter.create({ model: "users", data });

    expect(mockClient.db).toHaveBeenCalledWith("test_db");
    expect(mockDb.collection).toHaveBeenCalledWith("users");
    expect(mockCollection.insertOne as jest.Mock).toHaveBeenCalledWith(
      { _id: "123", name: "Test User" },
      { session: undefined }
    );

    expect(result).toHaveProperty("id", "123");
    expect(result).not.toHaveProperty("_id");
    expect(result.name).toBe("Test User");
  });

  it("should find one record and map _id to id", async () => {
    (mockCollection.findOne as jest.Mock).mockResolvedValue({ _id: "456", name: "Existing" });

    const result = await adapter.findOne({
      model: "users",
      where: [{ field: "id", value: "456" }],
    });

    expect(mockCollection.findOne as jest.Mock).toHaveBeenCalledWith(
      { _id: "456" },
      { projection: undefined, session: undefined }
    );
    expect(result).toEqual({ id: "456", name: "Existing" });
  });

  it("should find many records and map _id to id", async () => {
    const mockCursor = {
      project: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([{ _id: "1", name: "User 1" }]),
    };
    (mockCollection.find as jest.Mock).mockReturnValue(mockCursor);

    const result = await adapter.findMany({
      model: "users",
      where: [{ field: "name", value: "User 1" }],
    });

    expect(result[0]!.id).toBe("1");
    expect(mockCollection.find as jest.Mock).toHaveBeenCalledWith(
      { name: "User 1" },
      expect.any(Object)
    );
  });

  it("should handle OR conditions", async () => {
    const mockCursor = {
      project: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    };
    (mockCollection.find as jest.Mock).mockReturnValue(mockCursor);

    await adapter.findMany({
      model: "users",
      where: [
        { field: "name", value: "A", connector: "OR" },
        { field: "name", value: "B" },
      ],
    });

    expect(mockCollection.find as jest.Mock).toHaveBeenCalledWith(
      { $or: [{ name: "A" }, { name: "B" }] },
      expect.any(Object)
    );
  });

  it("should update a record", async () => {
    // Update calls collection.findOne to get target, then updateOne
    const data = { _id: "1", status: "old" };
    (mockCollection.findOne as jest.Mock).mockResolvedValue(data);

    (mockCollection.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

    const result = await adapter.update({
      model: "users",
      where: [{ field: "id", value: "1" }],
      update: { status: "new" },
    });

    expect(result).toEqual({ id: "1", status: "new" });
    expect(mockCollection.updateOne as jest.Mock).toHaveBeenCalledWith(
      { _id: "1" },
      { $set: { status: "new", id: "1" } },
      { session: undefined }
    );
  });

  it("should update multiple records", async () => {
    (mockCollection.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 3 });

    const count = await adapter.updateMany({
      model: "users",
      where: [{ field: "role", value: "user" }],
      update: { role: "guest" },
    });

    expect(mockCollection.updateMany as jest.Mock).toHaveBeenCalledWith(
      { role: "user" },
      { $set: { role: "guest" } },
      { session: undefined }
    );
    expect(count).toBe(3);
  });

  it("should delete multiple records", async () => {
    (mockCollection.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 2 });

    const count = await adapter.deleteMany({
      model: "users",
      where: [{ field: "role", value: "user" }],
    });

    expect(mockCollection.deleteMany as jest.Mock).toHaveBeenCalledWith(
      { role: "user" },
      { session: undefined }
    );
    expect(count).toBe(2);
  });

  it("should execute transactions", async () => {
    const mockSession = {
      withTransaction: jest.fn(async (cb) => cb()),
      endSession: jest.fn(),
    };
    (mockClient as unknown as Record<string, jest.Mock>).startSession = jest
      .fn()
      .mockReturnValue(mockSession);

    const result = await adapter.transaction(async (trx) => {
      await trx.create({ model: "users", data: { id: "trx_1" } });
      return "done";
    });

    expect((mockClient as unknown as Record<string, jest.Mock>).startSession).toHaveBeenCalled();
    expect(mockSession.withTransaction).toHaveBeenCalled();
    expect(mockCollection.insertOne as jest.Mock).toHaveBeenCalledWith(
      { _id: "trx_1" },
      { session: mockSession }
    );
    expect(result).toBe("done");
  });
});
