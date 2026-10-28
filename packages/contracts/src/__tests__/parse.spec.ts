import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseRequest, uuidSchema } from "../schemas";

const schema = z.strictObject({
  name: z.string().trim().min(1, "Informe o nome."),
  age: z.number().int().max(120),
});

function messages(input: unknown, throughEntry = true) {
  const result = throughEntry
    ? parseRequest(schema, input)
    : schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error?.issues.map((issue) => [issue.path, issue.message]);
}

describe("request parse entry", () => {
  it("returns the parsed output", () => {
    expect(parseRequest(schema, { name: " Ana ", age: 30 })).toEqual({
      success: true,
      data: { name: "Ana", age: 30 },
    });
  });

  it("keeps a message the schema declares", () => {
    expect(messages({ name: " ", age: 30 })).toEqual([
      [["name"], "Informe o nome."],
    ]);
  });

  it.each([
    ["a missing field", { name: "Ana" }, [["age"], "Preencha este campo."]],
    ["a wrong type", { name: "Ana", age: "30" }, [["age"], "Valor inválido."]],
    [
      "a rule without a message",
      { name: "Ana", age: 121 },
      [["age"], "Valor inválido."],
    ],
    ["a body that is not an object", "Ana", [[], "Valor inválido."]],
    [
      "unknown keys",
      { name: "Ana", age: 30, role: "x", plan: 1 },
      [[], "Campo não permitido."],
    ],
  ])("gives %s a pt-BR fallback that Zod's default differs from", (_case, input, expected) => {
    const [issue] = messages(input) ?? [];
    expect(issue).toEqual(expected);

    const [path, message] = expected as [unknown, string];
    expect(messages(input, false)).toContainEqual([path, expect.any(String)]);
    expect(messages(input, false)).not.toContainEqual([path, message]);
  });

  it("names every unknown key in its issue", () => {
    const result = parseRequest(schema, {
      name: "Ana",
      age: 30,
      role: "x",
      plan: 1,
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["role", "plan"],
      }),
    ]);
  });
});

describe("route ids", () => {
  it("accepts a UUID", () => {
    expect(
      uuidSchema.safeParse("0b6f1b44-6f3c-4b7a-8d3c-1f0a1c2d3e4f").success,
    ).toBe(true);
  });

  it.each([
    "abc",
    "1",
    "0b6f1b44-6f3c-4b7a-8d3c-1f0a1c2d3e4",
    "",
  ])("rejects %j", (id) => {
    expect(parseRequest(uuidSchema, id)).toMatchObject({
      success: false,
      error: { issues: [{ path: [], message: "Valor inválido." }] },
    });
  });
});
