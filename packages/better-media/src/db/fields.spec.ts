import { converters, serializeData, deserializeData } from "./fields";

describe("DB Fields Converters", () => {
  it("should convert strings", () => {
    const converter = converters["string"];
    expect(converter.serialize("test")).toBe("test");
    expect(converter.deserialize("test")).toBe("test");
  });

  it("should convert numbers", () => {
    const converter = converters["number"];
    expect(converter.serialize(123)).toBe(123);
    expect(converter.deserialize(123)).toBe(123);
  });

  it("should convert booleans", () => {
    const converter = converters["boolean"];
    expect(converter.serialize(true)).toBe(1);
    expect(converter.serialize(false)).toBe(0);
    // handles sqlite style 1/0
    expect(converter.deserialize(1)).toBe(true);
    expect(converter.deserialize(0)).toBe(false);
  });

  it("should convert dates", () => {
    const converter = converters["date"];
    const now = new Date();
    const iso = now.toISOString();

    expect(converter.serialize(now)).toBe(iso);
    expect(converter.deserialize(iso)).toBeInstanceOf(Date);
    expect((converter.deserialize(iso) as Date).toISOString()).toBe(iso);
  });

  it("should convert json", () => {
    const converter = converters["json"];
    const obj = { key: "value", num: 1 };

    expect(converter.serialize(obj)).toBe(JSON.stringify(obj));
    expect(converter.deserialize(JSON.stringify(obj))).toEqual(obj);

    // Safety check - handles null/already-parsed objects
    expect(converter.deserialize(null)).toBeNull();
    expect(converter.deserialize(obj)).toEqual(obj);
  });

  it("should serialize an entire record", () => {
    const fields = {
      id: { type: "string" as const },
      count: { type: "number" as const },
      active: { type: "boolean" as const },
      createdAt: { type: "date" as const },
      data: { type: "json" as const },
    };

    const date = new Date();
    const record = {
      id: "1",
      count: 10,
      active: true,
      createdAt: date,
      data: { foo: "bar" },
      unknownField: "kept as is",
    };

    const serialized = serializeData(fields, record);

    expect(serialized.id).toBe("1");
    expect(serialized.count).toBe(10);
    expect(serialized.active).toBe(1);
    expect(serialized.createdAt).toBe(date.toISOString());
    expect(serialized.data).toBe(JSON.stringify({ foo: "bar" }));
    expect(serialized.unknownField).toBe("kept as is");

    const deserialized = deserializeData(fields, serialized);
    expect(deserialized.createdAt).toBeInstanceOf(Date);
    expect(deserialized.data).toEqual({ foo: "bar" });
  });
});
