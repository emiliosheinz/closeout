import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  adminListingsQuerySchema,
  catalogQuerySchema,
  listingRequestSchema,
  listingStatusRequestSchema,
  listingUpdateRequestSchema,
  parseRequest,
  reorderImagesRequestSchema,
} from "../schemas";

const CATEGORY_ID = "0b6f1b44-6f3c-4b7a-8d3c-1f0a1c2d3e4f";
const SELLER_ID = "5f0c2b1e-3a4d-4e5f-8a6b-7c8d9e0f1a2b";
const IMAGE_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

const listing = {
  title: "Bike",
  categoryId: CATEGORY_ID,
  condition: "good",
  sellerIds: [SELLER_ID],
};

const INVALID_VALUE = "Valor inválido.";
const PRICE =
  'Use um valor como 1.200,00, ou deixe vazio para "Preço a combinar".';
const SELLERS = "Escolha ao menos uma pessoa para receber as mensagens.";
const LABEL = "Dê um nome de até 40 caracteres a cada característica.";
const VALUE = "Preencha cada característica com até 120 caracteres.";

function firstIssue(result: z.ZodSafeParseResult<unknown>) {
  expect(result.success).toBe(false);
  const [issue] = result.error?.issues ?? [];
  return { path: issue?.path, message: issue?.message };
}

describe("request schemas are strict", () => {
  it.each([
    ["catalog query", catalogQuerySchema, {}],
    ["admin listings query", adminListingsQuerySchema, {}],
    ["listing create", listingRequestSchema, listing],
    ["listing update", listingUpdateRequestSchema, {}],
    ["listing status", listingStatusRequestSchema, {}],
    ["photo reorder", reorderImagesRequestSchema, { ids: [] }],
  ] as const)("%s refuses an unknown key", (_name, schema, valid) => {
    expect(parseRequest(schema, valid).success).toBe(true);
    expect(firstIssue(parseRequest(schema, { ...valid, extra: 1 }))).toEqual({
      path: [],
      message: "Campo não permitido.",
    });
  });

  it("refuses an unknown key inside a listing attribute", () => {
    const result = parseRequest(listingRequestSchema, {
      ...listing,
      attributes: [{ label: "Cor", value: "Azul", note: "x" }],
    });
    expect(firstIssue(result).path).toEqual(["attributes", 0]);
  });
});

describe("catalog query", () => {
  it("coerces numbers from the query string", () => {
    expect(
      parseRequest(catalogQuerySchema, {
        page: "1000",
        pageSize: "100",
        minPrice: "0",
        maxPrice: "100000000",
      }).data,
    ).toEqual({ page: 1000, pageSize: 100, minPrice: 0, maxPrice: 100000000 });
    expect(
      parseRequest(catalogQuerySchema, { page: "1", pageSize: "1" }).data,
    ).toEqual({ page: 1, pageSize: 1 });
  });

  it.each([
    ["page", "0"],
    ["page", "1001"],
    ["page", "1.5"],
    ["page", "abc"],
    ["pageSize", "0"],
    ["pageSize", "101"],
    ["pageSize", "2.5"],
    ["minPrice", "-1"],
    ["minPrice", "100000001"],
    ["minPrice", "10.5"],
    ["maxPrice", "-1"],
    ["maxPrice", "100000001"],
    ["maxPrice", "10.5"],
    ["q", "x".repeat(101)],
    ["category", "x".repeat(61)],
    ["condition", "broken"],
    ["availability", "gone"],
    ["sort", "cheapest"],
  ])("rejects %s=%j with the pt-BR fallback", (key, value) => {
    expect(
      firstIssue(parseRequest(catalogQuerySchema, { [key]: value })),
    ).toEqual({
      path: [key],
      message: INVALID_VALUE,
    });
  });

  it("trims the search text", () => {
    expect(parseRequest(catalogQuerySchema, { q: "  bike " }).data).toEqual({
      q: "bike",
    });
  });
});

describe("admin listings query", () => {
  it("trims the search text and caps it at 100 characters", () => {
    expect(
      parseRequest(adminListingsQuerySchema, { q: " bike " }).data,
    ).toEqual({ q: "bike" });
    expect(
      firstIssue(
        parseRequest(adminListingsQuerySchema, { q: "x".repeat(101) }),
      ),
    ).toEqual({ path: ["q"], message: INVALID_VALUE });
  });
});

describe("listing create", () => {
  it.each([
    ["a non-UUID category", { categoryId: "c" }, ["categoryId"]],
    ["a non-UUID seller", { sellerIds: ["s"] }, ["sellerIds", 0]],
    ["an empty seller list", { sellerIds: [] }, ["sellerIds"]],
  ])("rejects %s", (_case, change, path) => {
    expect(
      firstIssue(parseRequest(listingRequestSchema, { ...listing, ...change }))
        .path,
    ).toEqual(path);
  });

  it("accepts a listing without sellers", () => {
    const { sellerIds: _omitted, ...withoutSellers } = listing;
    expect(parseRequest(listingRequestSchema, withoutSellers).success).toBe(
      true,
    );
  });

  // Each rule's own message, the same through the parse entry and without it,
  // because the web form parses this schema directly.
  it.each([
    ["title", { title: 1 }, "Dê um nome ao item."],
    ["title", { title: "  " }, "Dê um nome ao item."],
    ["title", { title: "x".repeat(121) }, "Use até 120 caracteres no nome."],
    ["description", { description: 1 }, "Escreva a descrição como texto."],
    [
      "description",
      { description: "x".repeat(5001) },
      "Use até 5000 caracteres na descrição.",
    ],
    ["categoryId", { categoryId: undefined }, "Escolha uma categoria."],
    ["categoryId", { categoryId: "c" }, "Escolha uma categoria."],
    ["sellerIds", { sellerIds: SELLER_ID }, SELLERS],
    ["sellerIds", { sellerIds: [] }, SELLERS],
    ["sellerIds", { sellerIds: ["s"] }, "Vendedor inválido."],
    [
      "sellerIds",
      {
        sellerIds: Array.from(
          { length: 11 },
          (_, i) =>
            `5f0c2b1e-3a4d-4e5f-8a6b-7c8d9e0f1a${String(i).padStart(2, "0")}`,
        ),
      },
      "Escolha no máximo 10 pessoas.",
    ],
    [
      "sellerIds",
      { sellerIds: [SELLER_ID, SELLER_ID] },
      "Escolha cada pessoa uma vez só.",
    ],
    ["priceCents", { priceCents: "12" }, PRICE],
    ["priceCents", { priceCents: 1.5 }, PRICE],
    ["priceCents", { priceCents: -1 }, PRICE],
    ["priceCents", { priceCents: 100_000_001 }, PRICE],
    ["condition", { condition: "broken" }, "Escolha o estado do item."],
    [
      "attributes",
      { attributes: "Cor" },
      "Informe as características como uma lista.",
    ],
    [
      "attributes",
      {
        attributes: Array.from({ length: 21 }, () => ({
          label: "Cor",
          value: "Azul",
        })),
      },
      "Use até 20 características.",
    ],
    ["attributes", { attributes: ["Cor"] }, LABEL],
    ["attributes", { attributes: [{ label: 1, value: "Azul" }] }, LABEL],
    ["attributes", { attributes: [{ label: " ", value: "Azul" }] }, LABEL],
    [
      "attributes",
      { attributes: [{ label: "x".repeat(41), value: "Azul" }] },
      LABEL,
    ],
    ["attributes", { attributes: [{ label: "Cor", value: 1 }] }, VALUE],
    ["attributes", { attributes: [{ label: "Cor", value: " " }] }, VALUE],
    [
      "attributes",
      { attributes: [{ label: "Cor", value: "x".repeat(121) }] },
      VALUE,
    ],
  ])("%s %j gives %j", (field, change, message) => {
    const input = { ...listing, ...change };
    for (const result of [
      parseRequest(listingRequestSchema, input),
      listingRequestSchema.safeParse(input),
    ]) {
      const issue = firstIssue(result);
      expect(issue.path?.[0]).toBe(field);
      expect(issue.message).toBe(message);
    }
  });
});

describe("listing update", () => {
  it("accepts any subset of fields, plus availability and publication", () => {
    expect(
      parseRequest(listingUpdateRequestSchema, {
        title: " Bike ",
        priceCents: null,
        availability: "sold",
        publication: "published",
      }).data,
    ).toEqual({
      title: "Bike",
      priceCents: null,
      availability: "sold",
      publication: "published",
    });
  });

  it.each([
    ["a non-UUID category", { categoryId: "c" }, "Escolha uma categoria."],
    ["a non-UUID seller", { sellerIds: ["s"] }, "Vendedor inválido."],
    ["an empty seller list", { sellerIds: [] }, SELLERS],
    ["an empty title", { title: " " }, "Dê um nome ao item."],
    ["an unknown availability", { availability: "gone" }, INVALID_VALUE],
    ["an unknown publication", { publication: "hidden" }, INVALID_VALUE],
  ])("rejects %s", (_case, change, message) => {
    expect(
      firstIssue(parseRequest(listingUpdateRequestSchema, change)).message,
    ).toBe(message);
  });
});

describe("listing status", () => {
  it.each([
    [{ availability: "gone" }, ["availability"]],
    [{ publication: "hidden" }, ["publication"]],
  ])("rejects %j with the pt-BR fallback", (body, path) => {
    expect(firstIssue(parseRequest(listingStatusRequestSchema, body))).toEqual({
      path,
      message: INVALID_VALUE,
    });
  });
});

describe("photo reorder", () => {
  it.each([
    [{}, ["ids"], "Preencha este campo."],
    [{ ids: IMAGE_ID }, ["ids"], INVALID_VALUE],
    [{ ids: ["x"] }, ["ids", 0], INVALID_VALUE],
    [
      { ids: Array.from({ length: 51 }, () => IMAGE_ID) },
      ["ids"],
      INVALID_VALUE,
    ],
  ])("rejects %j with a pt-BR message", (body, path, message) => {
    expect(firstIssue(parseRequest(reorderImagesRequestSchema, body))).toEqual({
      path,
      message,
    });
  });
});
