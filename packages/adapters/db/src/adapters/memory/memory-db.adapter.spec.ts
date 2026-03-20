import { MemoryDbAdapter } from "./memory-db.adapter";

describe("MemoryDbAdapter", () => {
  let adapter: MemoryDbAdapter;

  beforeEach(() => {
    adapter = new MemoryDbAdapter();
  });

  afterEach(() => {
    adapter.clear();
  });

  it("should create and find a record", async () => {
    const data = { id: "1", name: "Test User", age: 30 };
    await adapter.create({ model: "users", data });

    const found = await adapter.findOne({
      model: "users",
      where: [{ field: "id", value: "1" }],
    });

    expect(found).toEqual(data);
  });

  it("should find multiple records with filtering", async () => {
    await adapter.create({ model: "users", data: { id: "1", group: "admin", score: 10 } });
    await adapter.create({ model: "users", data: { id: "2", group: "user", score: 20 } });
    await adapter.create({ model: "users", data: { id: "3", group: "user", score: 30 } });

    const users = await adapter.findMany({
      model: "users",
      where: [{ field: "group", value: "user" }],
    });

    expect(users).toHaveLength(2);
    expect(users.map((u: Record<string, unknown>) => u.id)).toEqual(
      expect.arrayContaining(["2", "3"])
    );
  });

  it("should support operators like >, <, >=", async () => {
    await adapter.create({ model: "users", data: { id: "1", score: 10 } });
    await adapter.create({ model: "users", data: { id: "2", score: 20 } });
    await adapter.create({ model: "users", data: { id: "3", score: 30 } });

    const users = await adapter.findMany({
      model: "users",
      where: [{ field: "score", operator: ">", value: 15 }],
    });

    expect(users).toHaveLength(2);
  });

  it("should update a record", async () => {
    await adapter.create({ model: "users", data: { id: "1", name: "Old Name", score: 10 } });

    const updated = await adapter.update({
      model: "users",
      where: [{ field: "id", value: "1" }],
      update: { name: "New Name", score: 20 },
    });

    expect(updated?.name).toBe("New Name");
    expect(updated?.score).toBe(20);

    const check = await adapter.findOne({ model: "users", where: [{ field: "id", value: "1" }] });
    expect(check?.name).toBe("New Name");
  });

  it("should delete a record", async () => {
    await adapter.create({ model: "users", data: { id: "1", name: "Test User" } });
    await adapter.create({ model: "users", data: { id: "2", name: "Another User" } });

    await adapter.delete({ model: "users", where: [{ field: "id", value: "1" }] });

    const user1 = await adapter.findOne({ model: "users", where: [{ field: "id", value: "1" }] });
    const user2 = await adapter.findOne({ model: "users", where: [{ field: "id", value: "2" }] });

    expect(user1).toBeNull();
    expect(user2).not.toBeNull();
  });

  it("should update multiple records", async () => {
    await adapter.create({ model: "users", data: { id: "10", role: "admin" } });
    await adapter.create({ model: "users", data: { id: "20", role: "user" } });
    await adapter.create({ model: "users", data: { id: "30", role: "user" } });

    const count = await adapter.updateMany({
      model: "users",
      where: [{ field: "role", value: "user" }],
      update: { role: "guest" },
    });

    expect(count).toBe(2);

    const u20 = await adapter.findOne({ model: "users", where: [{ field: "id", value: "20" }] });
    expect((u20 as Record<string, unknown>)?.role).toBe("guest");
  });

  it("should delete multiple records", async () => {
    await adapter.create({ model: "users", data: { id: "40", role: "admin" } });
    await adapter.create({ model: "users", data: { id: "50", role: "user" } });
    await adapter.create({ model: "users", data: { id: "60", role: "user" } });

    const count = await adapter.deleteMany({
      model: "users",
      where: [{ field: "role", value: "user" }],
    });

    expect(count).toBe(2);

    const check = await adapter.count({
      model: "users",
      where: [{ field: "role", value: "user" }],
    });
    expect(check).toBe(0);
  });

  it("should execute transactions", async () => {
    const result = await adapter.transaction(async (trx) => {
      await trx.create({ model: "users", data: { id: "70", role: "trx_user" } });
      return "done";
    });

    expect(result).toBe("done");

    const check = await adapter.count({ model: "users", where: [{ field: "id", value: "70" }] });
    expect(check).toBe(1);
  });

  it("should support advanced string operators", async () => {
    await adapter.create({ model: "docs", data: { id: "100", title: "Hello World" } });

    const countStarts = await adapter.count({
      model: "docs",
      where: [{ field: "title", operator: "starts_with", value: "he" }],
    });
    expect(countStarts).toBe(1);

    const countEnds = await adapter.count({
      model: "docs",
      where: [{ field: "title", operator: "ends_with", value: "rld" }],
    });
    expect(countEnds).toBe(1);

    const countNotIn = await adapter.count({
      model: "docs",
      where: [{ field: "title", operator: "not_in", value: ["foo", "bar"] }],
    });
    expect(countNotIn).toBe(1);
  });

  it("should count records", async () => {
    await adapter.create({ model: "users", data: { id: "1", type: "free" } });
    await adapter.create({ model: "users", data: { id: "2", type: "pro" } });
    await adapter.create({ model: "users", data: { id: "3", type: "free" } });

    const countFree = await adapter.count({
      model: "users",
      where: [{ field: "type", value: "free" }],
    });

    expect(countFree).toBe(2);
  });
});
