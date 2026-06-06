import type { MongoClient } from "mongodb";
import { MongoDbAdapter } from "./mongodb-db.adapter";

const softDeleteSchema = {
  posts: {
    fields: { id: { type: "string" as const }, title: { type: "string" as const } },
    softDelete: true,
  },
};

describe("MongoDbAdapter", () => {
  let adapter: MongoDbAdapter;
  let mockClient: Record<string, unknown>;
  let mockDb: Record<string, unknown>;
  let mockCollection: Record<string, unknown>;
  let mockCursor: Record<string, unknown>;

  beforeEach(() => {
    mockCursor = {
      project: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    };

    mockCollection = {
      insertOne: jest.fn().mockResolvedValue({ insertedId: "123" }),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockReturnValue(mockCursor),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
      countDocuments: jest.fn().mockResolvedValue(0),
      createIndex: jest.fn().mockResolvedValue("index_name"),
      listIndexes: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      listCollections: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      createCollection: jest.fn().mockResolvedValue(undefined),
      databaseName: "test_db",
      command: jest.fn().mockResolvedValue({ ok: 1 }),
    };

    mockClient = {
      db: jest.fn().mockReturnValue(mockDb),
    };

    adapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
      config: { databaseName: "test_db" },
      schema: { users: { fields: { id: { type: "string" }, name: { type: "string" } } } },
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    it("maps id → _id on insert and returns id in result", async () => {
      const data = { id: "123", name: "Test User" };
      const result = await adapter.create({ model: "users", data });

      expect(mockCollection.insertOne as jest.Mock).toHaveBeenCalledWith(
        { _id: "123", name: "Test User" },
        { session: undefined }
      );
      expect(result).toHaveProperty("id", "123");
      expect(result).not.toHaveProperty("_id");
    });

    it("inserts document without _id when data has no id", async () => {
      await adapter.create({ model: "users", data: { name: "No ID" } });
      const call = (mockCollection.insertOne as jest.Mock).mock.calls[0]![0];
      expect(call).not.toHaveProperty("id");
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe("findOne", () => {
    it("maps _id → id in result", async () => {
      (mockCollection.findOne as jest.Mock).mockResolvedValue({ _id: "456", name: "Existing" });

      const result = await adapter.findOne({
        model: "users",
        where: [{ field: "id", value: "456" }],
      });

      expect(result).toEqual({ id: "456", name: "Existing" });
    });

    it("returns null when no document matches", async () => {
      (mockCollection.findOne as jest.Mock).mockResolvedValue(null);
      const result = await adapter.findOne({ model: "users", where: [] });
      expect(result).toBeNull();
    });

    it("applies select projection and remaps id → _id", async () => {
      (mockCollection.findOne as jest.Mock).mockResolvedValue({ _id: "1", name: "A" });

      await adapter.findOne({
        model: "users",
        where: [],
        select: ["id", "name"],
      });

      const call = (mockCollection.findOne as jest.Mock).mock.calls[0]![1];
      expect(call.projection).toEqual({ _id: 1, name: 1 });
    });

    it("excludes soft-deleted records by default", async () => {
      const softAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: softDeleteSchema,
      });

      (mockCollection.findOne as jest.Mock).mockResolvedValue(null);
      await softAdapter.findOne({ model: "posts", where: [] });

      const filter = (mockCollection.findOne as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ deletedAt: null });
    });

    it("includes soft-deleted records when withDeleted is true", async () => {
      const softAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: softDeleteSchema,
      });

      (mockCollection.findOne as jest.Mock).mockResolvedValue(null);
      await softAdapter.findOne({ model: "posts", where: [], withDeleted: true });

      const filter = (mockCollection.findOne as jest.Mock).mock.calls[0]![0];
      expect(filter).not.toHaveProperty("deletedAt");
    });
  });

  // ---------------------------------------------------------------------------
  // findMany
  // ---------------------------------------------------------------------------

  describe("findMany", () => {
    it("finds and maps records", async () => {
      (mockCursor.toArray as jest.Mock).mockResolvedValue([{ _id: "1", name: "User 1" }]);
      const result = await adapter.findMany({ model: "users" });
      expect(result[0]!.id).toBe("1");
    });

    it("builds AND filter from multiple conditions (default connector)", async () => {
      await adapter.findMany({
        model: "users",
        where: [
          { field: "name", value: "A" },
          { field: "name", value: "B" },
        ],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ $and: [{ name: "A" }, { name: "B" }] });
    });

    it("builds OR filter when connector is OR", async () => {
      await adapter.findMany({
        model: "users",
        where: [
          { field: "name", value: "A", connector: "OR" },
          { field: "name", value: "B" },
        ],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ $or: [{ name: "A" }, { name: "B" }] });
    });

    it("applies sortBy asc", async () => {
      await adapter.findMany({ model: "users", sortBy: { field: "name", direction: "asc" } });
      expect(mockCursor.sort as jest.Mock).toHaveBeenCalledWith({ name: 1 });
    });

    it("applies sortBy desc", async () => {
      await adapter.findMany({ model: "users", sortBy: { field: "name", direction: "desc" } });
      expect(mockCursor.sort as jest.Mock).toHaveBeenCalledWith({ name: -1 });
    });

    it("applies limit", async () => {
      await adapter.findMany({ model: "users", limit: 10 });
      expect(mockCursor.limit as jest.Mock).toHaveBeenCalledWith(10);
    });

    it("applies offset via skip", async () => {
      await adapter.findMany({ model: "users", offset: 20 });
      expect(mockCursor.skip as jest.Mock).toHaveBeenCalledWith(20);
    });

    it("applies select projection", async () => {
      await adapter.findMany({ model: "users", select: ["id", "name"] });
      expect(mockCursor.project as jest.Mock).toHaveBeenCalledWith({ _id: 1, name: 1 });
    });

    it("operator != → $ne", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "name", operator: "!=", value: "banned" }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ name: { $ne: "banned" } });
    });

    it("operator < → $lt", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "score", operator: "<", value: 50 }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ score: { $lt: 50 } });
    });

    it("operator > → $gt", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "score", operator: ">", value: 10 }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ score: { $gt: 10 } });
    });

    it("operator <= → $lte", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "score", operator: "<=", value: 100 }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ score: { $lte: 100 } });
    });

    it("operator >= → $gte", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "score", operator: ">=", value: 0 }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ score: { $gte: 0 } });
    });

    it("operator in → $in", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "role", operator: "in", value: ["admin", "mod"] }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ role: { $in: ["admin", "mod"] } });
    });

    it("operator not_in → $nin", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "role", operator: "not_in", value: ["banned"] }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ role: { $nin: ["banned"] } });
    });

    it("operator starts_with → $regex anchored at start", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "name", operator: "starts_with", value: "Al" }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter.name.$regex.source).toBe("^Al");
      expect(filter.name.$regex.flags).toContain("i");
    });

    it("operator ends_with → $regex anchored at end", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "name", operator: "ends_with", value: "son" }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter.name.$regex.source).toBe("son$");
    });

    it("operator contains → $regex unanchored", async () => {
      await adapter.findMany({
        model: "users",
        where: [{ field: "name", operator: "contains", value: "lee" }],
      });
      const filter = (mockCollection.find as jest.Mock).mock.calls[0]![0];
      expect(filter.name.$regex.source).toBe("lee");
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    it("merges fields, excludes id from $set, returns merged record", async () => {
      (mockCollection.findOne as jest.Mock).mockResolvedValue({ _id: "1", status: "old" });

      const result = await adapter.update({
        model: "users",
        where: [{ field: "id", value: "1" }],
        update: { status: "new" },
      });

      expect(result).toEqual({ id: "1", status: "new" });
      expect(mockCollection.updateOne as jest.Mock).toHaveBeenCalledWith(
        { _id: "1" },
        { $set: { status: "new" } },
        { session: undefined }
      );
    });

    it("returns null when no document matches", async () => {
      (mockCollection.findOne as jest.Mock).mockResolvedValue(null);
      const result = await adapter.update({
        model: "users",
        where: [{ field: "id", value: "missing" }],
        update: { name: "x" },
      });
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateMany
  // ---------------------------------------------------------------------------

  describe("updateMany", () => {
    it("updates and returns modifiedCount", async () => {
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
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe("delete", () => {
    it("calls deleteOne when where is a single id match", async () => {
      await adapter.delete({
        model: "users",
        where: [{ field: "id", value: "1" }],
      });
      expect(mockCollection.deleteOne as jest.Mock).toHaveBeenCalledWith(
        { _id: "1" },
        { session: undefined }
      );
      expect(mockCollection.deleteMany as jest.Mock).not.toHaveBeenCalled();
    });

    it("calls deleteMany for multi-condition where", async () => {
      await adapter.delete({
        model: "users",
        where: [
          { field: "role", value: "guest" },
          { field: "active", value: false },
        ],
      });
      expect(mockCollection.deleteMany as jest.Mock).toHaveBeenCalled();
      expect(mockCollection.deleteOne as jest.Mock).not.toHaveBeenCalled();
    });

    it("sets deletedAt instead of deleting for soft-delete models", async () => {
      const softAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: softDeleteSchema,
      });

      await softAdapter.delete({ model: "posts", where: [{ field: "id", value: "p1" }] });

      expect(mockCollection.deleteOne as jest.Mock).not.toHaveBeenCalled();
      expect(mockCollection.deleteMany as jest.Mock).not.toHaveBeenCalled();
      const updateCall = (mockCollection.updateMany as jest.Mock).mock.calls[0]![1];
      expect(updateCall.$set).toHaveProperty("deletedAt");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteMany
  // ---------------------------------------------------------------------------

  describe("deleteMany", () => {
    it("deletes and returns deletedCount", async () => {
      (mockCollection.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 2 });

      const count = await adapter.deleteMany({
        model: "users",
        where: [{ field: "role", value: "guest" }],
      });

      expect(count).toBe(2);
    });

    it("sets deletedAt instead of deleting for soft-delete models", async () => {
      (mockCollection.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 4 });
      const softAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: softDeleteSchema,
      });

      const count = await softAdapter.deleteMany({
        model: "posts",
        where: [{ field: "title", value: "Draft" }],
      });

      expect(mockCollection.deleteMany as jest.Mock).not.toHaveBeenCalled();
      expect(count).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // count
  // ---------------------------------------------------------------------------

  describe("count", () => {
    it("returns countDocuments result with no where", async () => {
      (mockCollection.countDocuments as jest.Mock).mockResolvedValue(7);
      const result = await adapter.count({ model: "users" });
      expect(result).toBe(7);
      expect(mockCollection.countDocuments as jest.Mock).toHaveBeenCalledWith(
        {},
        { session: undefined }
      );
    });

    it("passes filter to countDocuments when where is provided", async () => {
      (mockCollection.countDocuments as jest.Mock).mockResolvedValue(3);
      const result = await adapter.count({
        model: "users",
        where: [{ field: "role", value: "admin" }],
      });
      expect(result).toBe(3);
      const filter = (mockCollection.countDocuments as jest.Mock).mock.calls[0]![0];
      expect(filter).toEqual({ role: "admin" });
    });
  });

  // ---------------------------------------------------------------------------
  // raw
  // ---------------------------------------------------------------------------

  describe("raw", () => {
    it("calls db.command with parsed JSON when query starts with {", async () => {
      (mockDb.command as jest.Mock).mockResolvedValue({ ok: 1, version: "7.0" });
      const result = await adapter.raw<{ ok: number }>('{"buildInfo": 1}');
      expect(mockDb.command as jest.Mock).toHaveBeenCalledWith({ buildInfo: 1 });
      expect(result).toEqual({ ok: 1, version: "7.0" });
    });

    it("throws for non-JSON query string", async () => {
      await expect(adapter.raw("SELECT 1")).rejects.toThrow(
        "MongoDB 'raw' requires a JSON command string."
      );
    });
  });

  // ---------------------------------------------------------------------------
  // transaction
  // ---------------------------------------------------------------------------

  describe("transaction", () => {
    it("runs callback with session-aware adapter and returns result", async () => {
      const mockSession = {
        withTransaction: jest.fn(async (cb: () => Promise<unknown>) => cb()),
        endSession: jest.fn(),
      };
      (mockClient as Record<string, jest.Mock>).startSession = jest
        .fn()
        .mockReturnValue(mockSession);

      const result = await adapter.transaction(async (trx) => {
        await trx.create({ model: "users", data: { id: "trx_1" } });
        return "done";
      });

      expect((mockClient as Record<string, jest.Mock>).startSession).toHaveBeenCalled();
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(mockCollection.insertOne as jest.Mock).toHaveBeenCalledWith(
        { _id: "trx_1" },
        { session: mockSession }
      );
      expect(result).toBe("done");
    });
  });

  // ---------------------------------------------------------------------------
  // __initCollection
  // ---------------------------------------------------------------------------

  describe("__initCollection", () => {
    const fullSchema = {
      articles: {
        fields: {
          id: { type: "string" as const, primaryKey: true },
          slug: { type: "string" as const, unique: true },
          authorId: {
            type: "string" as const,
            references: { model: "users", field: "id", onDelete: "cascade" as const },
          },
        },
        indexes: [{ fields: ["slug", "authorId"], unique: false }],
      },
    };

    it("creates collection when it does not exist", async () => {
      (mockDb.listCollections as jest.Mock).mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const schemaAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: fullSchema,
      });

      await schemaAdapter.__initCollection("articles", fullSchema.articles, { mode: "safe" });

      expect(mockDb.createCollection as jest.Mock).toHaveBeenCalledWith("articles");
    });

    it("skips createCollection when collection already exists", async () => {
      (mockDb.listCollections as jest.Mock).mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ name: "articles" }]),
      });

      const schemaAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: fullSchema,
      });

      await schemaAdapter.__initCollection("articles", fullSchema.articles, { mode: "safe" });

      expect(mockDb.createCollection as jest.Mock).not.toHaveBeenCalled();
    });

    it("creates unique index for unique (non-primary-key) fields", async () => {
      const schemaAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: fullSchema,
      });

      await schemaAdapter.__initCollection("articles", fullSchema.articles, { mode: "safe" });

      const indexCalls = (mockCollection.createIndex as jest.Mock).mock.calls;
      const uniqueCall = indexCalls.find(
        (c) => JSON.stringify(c[0]) === JSON.stringify({ slug: 1 }) && c[1]?.unique === true
      );
      expect(uniqueCall).toBeDefined();
    });

    it("creates non-unique index for reference fields", async () => {
      const schemaAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: fullSchema,
      });

      await schemaAdapter.__initCollection("articles", fullSchema.articles, { mode: "safe" });

      const indexCalls = (mockCollection.createIndex as jest.Mock).mock.calls;
      const refCall = indexCalls.find(
        (c) => JSON.stringify(c[0]) === JSON.stringify({ authorId: 1 }) && !c[1]?.unique
      );
      expect(refCall).toBeDefined();
    });

    it("drops collection before creating in force mode", async () => {
      const dropMock = jest.fn().mockResolvedValue(undefined);
      (mockCollection as Record<string, unknown>).drop = dropMock;

      const schemaAdapter = new MongoDbAdapter(mockClient as unknown as MongoClient, {
        config: { databaseName: "test_db" },
        schema: fullSchema,
      });

      await schemaAdapter.__initCollection("articles", fullSchema.articles, { mode: "force" });

      expect(dropMock).toHaveBeenCalled();
    });
  });
});
