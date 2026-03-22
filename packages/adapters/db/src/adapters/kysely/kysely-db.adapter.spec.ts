import type { Kysely } from "kysely";
import { KyselyDbAdapter, type DbSchema } from "./kysely-db.adapter";

describe("KyselyDbAdapter", () => {
  let adapter: KyselyDbAdapter;
  let mockDb: Record<string, unknown>;
  let mockQueryBuilder: Record<string, unknown>;

  beforeEach(() => {
    mockQueryBuilder = {
      selectAll: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([]),
      executeTakeFirst: jest.fn().mockResolvedValue(undefined),
    };

    const schemaBuilder = {
      createTable: jest.fn().mockReturnThis(),
      ifNotExists: jest.fn().mockReturnThis(),
      addColumn: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      selectFrom: jest.fn().mockReturnValue(mockQueryBuilder),
      insertInto: jest.fn().mockReturnValue(mockQueryBuilder),
      updateTable: jest.fn().mockReturnValue(mockQueryBuilder),
      deleteFrom: jest.fn().mockReturnValue(mockQueryBuilder),
      schema: schemaBuilder,
      fn: { count: jest.fn().mockReturnValue({ as: jest.fn() }) },
    };

    adapter = new KyselyDbAdapter(mockDb as unknown as Kysely<DbSchema>, {
      config: { provider: "pg" },
      schema: { users: { fields: {} } },
    });
  });

  it("should create a record", async () => {
    const data = { id: "1", name: "Test" };
    (mockQueryBuilder.executeTakeFirst as jest.Mock).mockResolvedValue(data);

    const result = await adapter.create({ model: "users", data });

    expect(mockDb.insertInto).toHaveBeenCalledWith("users");
    expect(mockQueryBuilder.values).toHaveBeenCalledWith(data);
    expect(result).toEqual(data);
  });

  it("should find one record", async () => {
    const data = { id: "1", name: "Test" };
    (mockQueryBuilder.executeTakeFirst as jest.Mock).mockResolvedValue(data);

    const result = await adapter.findOne({
      model: "users",
      where: [{ field: "id", value: "1" }],
    });

    expect(mockDb.selectFrom).toHaveBeenCalledWith("users");
    expect(mockQueryBuilder.selectAll as jest.Mock).toHaveBeenCalled();
    expect(mockQueryBuilder.where as jest.Mock).toHaveBeenCalledWith("id", "=", "1");
    expect(result).toEqual(data);
  });

  it("should find multiple records with options", async () => {
    const data = [
      { id: "1", name: "Test 1" },
      { id: "2", name: "Test 2" },
    ];
    (mockQueryBuilder.execute as jest.Mock).mockResolvedValue(data);

    const result = await adapter.findMany({
      model: "users",
      where: [{ field: "name", value: "Test", operator: "contains" }],
      sortBy: { field: "id", direction: "desc" },
      limit: 10,
      offset: 5,
    });

    expect(mockDb.selectFrom).toHaveBeenCalledWith("users");
    expect(mockQueryBuilder.where as jest.Mock).toHaveBeenCalledWith("name", "like", "%Test%");
    expect(mockQueryBuilder.orderBy as jest.Mock).toHaveBeenCalledWith("id", "desc");
    expect(mockQueryBuilder.limit as jest.Mock).toHaveBeenCalledWith(10);
    expect(mockQueryBuilder.offset as jest.Mock).toHaveBeenCalledWith(5);
    expect(result).toEqual(data);
  });

  it("should handle OR conditions", async () => {
    await adapter.findMany({
      model: "users",
      where: [
        { field: "name", value: "A", connector: "OR" },
        { field: "name", value: "B" },
      ],
    });

    expect(mockQueryBuilder.where as jest.Mock).toHaveBeenCalledWith("name", "=", "A");
    expect(mockQueryBuilder.orWhere as jest.Mock).toHaveBeenCalledWith("name", "=", "B");
  });

  it("should update multiple records", async () => {
    (mockQueryBuilder.execute as jest.Mock).mockResolvedValue([{ numUpdatedRows: 5n }]);

    const result = await adapter.updateMany({
      model: "users",
      where: [{ field: "active", value: false }],
      update: { active: true },
    });

    expect(mockDb.updateTable).toHaveBeenCalledWith("users");
    expect(mockQueryBuilder.set as jest.Mock).toHaveBeenCalledWith({ active: true });
    expect(result).toBe(5);
  });

  it("should delete multiple records", async () => {
    (mockQueryBuilder.execute as jest.Mock).mockResolvedValue([{ numDeletedRows: 3n }]);

    const result = await adapter.deleteMany({
      model: "users",
      where: [{ field: "id", value: ["1", "2"], operator: "in" }],
    });

    expect(mockDb.deleteFrom).toHaveBeenCalledWith("users");
    expect(mockQueryBuilder.where as jest.Mock).toHaveBeenCalledWith("id", "in", ["1", "2"]);
    expect(result).toBe(3);
  });

  it("should handle transactions", async () => {
    const mockTrx = { ...mockDb };
    mockDb.transaction = jest.fn().mockReturnThis();
    mockDb.execute = jest.fn().mockImplementation((cb) => cb(mockTrx));

    const result = await adapter.transaction(async (trx) => {
      await trx.create({ model: "users", data: { id: "1" } });
      return "done";
    });

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(result).toBe("done");
  });
});
