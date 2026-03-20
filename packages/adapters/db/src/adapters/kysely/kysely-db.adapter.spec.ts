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

  it("should update a record", async () => {
    (mockQueryBuilder.execute as jest.Mock).mockResolvedValue([]);

    await adapter.update({
      model: "users",
      where: [{ field: "id", value: "1" }],
      update: { name: "New Name" },
    });

    expect(mockDb.updateTable).toHaveBeenCalledWith("users");
    expect(mockQueryBuilder.set as jest.Mock).toHaveBeenCalledWith({ name: "New Name" });
    expect(mockQueryBuilder.where as jest.Mock).toHaveBeenCalledWith("id", "=", "1");
  });

  it("should count records", async () => {
    (mockQueryBuilder.executeTakeFirst as jest.Mock).mockResolvedValue({ c: 10 });

    const result = await adapter.count({ model: "users" });

    expect(mockDb.selectFrom).toHaveBeenCalledWith("users");
    expect(result).toBe(10);
  });
});
