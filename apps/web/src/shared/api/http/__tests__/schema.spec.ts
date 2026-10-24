import { dropInvalid, listOf, type Schema } from "../schema";

const named: Schema<{ name: string }> = {
  safeParse: (data) =>
    typeof data === "object" &&
    data !== null &&
    "name" in data &&
    typeof data.name === "string"
      ? { success: true, data: { name: data.name } }
      : { success: false, error: new Error("no name") },
};

describe("listOf", () => {
  it("parses every item", () => {
    expect(
      listOf(named).safeParse({ items: [{ name: "a", extra: 1 }] }),
    ).toEqual({ success: true, data: { items: [{ name: "a" }] } });
  });

  it("fails when one item or the items array is bad", () => {
    expect(
      listOf(named).safeParse({ items: [{ name: "a" }, {}] }).success,
    ).toBe(false);
    expect(listOf(named).safeParse({}).success).toBe(false);
  });
});

describe("dropInvalid", () => {
  it("keeps valid items in order and logs each dropped one", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      dropInvalid([{ name: "a" }, {}, { name: "b" }, 3], named, "test"),
    ).toEqual([{ name: "a" }, { name: "b" }]);
    expect(logged).toHaveBeenCalledTimes(2);
  });
});
