import { describe, expect, it } from "vitest";
import {
  acceptInviteRequestSchema,
  adminListingDetailSchema,
  inviteRequestSchema,
  listingRequestSchema,
  loginRequestSchema,
  MAX_PRICE_CENTS,
  publicListingDetailSchema,
  publicListingPageSchema,
  sellerRequestSchema,
  sellerSchema,
  storeRequestSchema,
  teamMemberSchema,
} from "../schemas";

const summary = {
  slug: "bike",
  title: "Bike",
  priceCents: 12000,
  condition: "good",
  availability: "available",
  category: { slug: "esportes", name: "Esportes" },
  cover: null,
};

const publicDetail = {
  ...summary,
  description: "",
  attributes: [{ label: "Cor", value: "Azul" }],
  images: [],
  sellers: [{ name: "Ana", avatarUrl: null, whatsappNumber: null }],
  canContact: false,
  publishedAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T11:00:00.000Z",
  related: [summary],
};

const adminDetail = {
  id: "1",
  slug: "bike",
  title: "Bike",
  priceCents: null,
  condition: "new",
  availability: "sold",
  publication: "draft",
  category: { id: "c", name: "Esportes" },
  sellers: [{ id: "s", displayName: "Ana" }],
  coverUrl: null,
  imageCount: 0,
  updatedAt: "2026-10-24T11:00:00.000Z",
  description: "",
  attributes: [],
  images: [],
};

function messageFor(
  result: { success: boolean; error?: { issues: { message: string }[] } },
  index = 0,
) {
  expect(result.success).toBe(false);
  return result.error?.issues[index]?.message;
}

describe("response schemas", () => {
  it("strips unknown keys", () => {
    const parsed = publicListingDetailSchema.parse({
      ...publicDetail,
      internalNote: "x",
      category: { ...summary.category, extra: 1 },
    });
    expect(parsed).toEqual(publicDetail);
  });

  it("strips unknown keys from admin responses", () => {
    expect(
      adminListingDetailSchema.parse({ ...adminDetail, storageKey: "k" }),
    ).toEqual(adminDetail);
  });

  it("keeps dates as ISO strings and rejects other date shapes", () => {
    const parsed = publicListingDetailSchema.parse(publicDetail);
    expect(parsed.updatedAt).toBe("2026-10-24T11:00:00.000Z");
    expect(
      publicListingDetailSchema.safeParse({
        ...publicDetail,
        updatedAt: new Date(),
      }).success,
    ).toBe(false);
    expect(
      publicListingDetailSchema.safeParse({
        ...publicDetail,
        updatedAt: "24/10/2026",
      }).success,
    ).toBe(false);
  });

  it("rejects a value outside the enum", () => {
    expect(
      adminListingDetailSchema.safeParse({
        ...adminDetail,
        publication: "deleted",
      }).success,
    ).toBe(false);
  });
});

describe("other response schemas", () => {
  it("passes a malformed page item through unchanged", () => {
    const bad = { slug: 5 };
    const parsed = publicListingPageSchema.parse({
      items: [summary, bad],
      total: 2,
      page: 1,
      pageSize: 12,
      extra: true,
    });
    expect(parsed).toEqual({
      items: [summary, bad],
      total: 2,
      page: 1,
      pageSize: 12,
    });
  });

  it("parses a seller and drops unknown keys", () => {
    const seller = {
      id: "s",
      userId: "u",
      displayName: "Ana",
      whatsappNumber: null,
      avatarUrl: null,
      listingCount: 2,
    };
    expect(sellerSchema.parse({ ...seller, avatarKey: "k" })).toEqual(seller);
  });

  it("parses a team member and drops unknown keys", () => {
    const member = {
      userId: "u",
      name: "Ana",
      email: "ana@x.com",
      role: "admin",
      sellerId: "s",
      displayName: "Ana",
      whatsappNumber: "5511999998888",
      avatarUrl: null,
      listingCount: 0,
    };
    expect(teamMemberSchema.parse({ ...member, avatarKey: "k" })).toEqual(
      member,
    );
  });
});

describe("request messages", () => {
  const listing = {
    title: "Bike",
    categoryId: "c",
    condition: "good",
    sellerIds: ["s"],
  };

  it("asks for a listing title", () => {
    expect(
      messageFor(listingRequestSchema.safeParse({ ...listing, title: "  " })),
    ).toBe("Dê um nome ao item.");
  });

  it("asks for at least one seller", () => {
    expect(
      messageFor(listingRequestSchema.safeParse({ ...listing, sellerIds: [] })),
    ).toBe("Escolha ao menos uma pessoa para receber as mensagens.");
  });

  it("explains the price format", () => {
    expect(
      messageFor(
        listingRequestSchema.safeParse({ ...listing, priceCents: -1 }),
      ),
    ).toBe(
      'Use um valor como 1.200,00, ou deixe vazio para "Preço a combinar".',
    );
  });

  it.each([
    ["a fraction of a cent", 10.5],
    ["a string", "12,00"],
    ["above the maximum", MAX_PRICE_CENTS + 1],
  ])("explains the price format for %s", (_, priceCents) => {
    expect(
      messageFor(listingRequestSchema.safeParse({ ...listing, priceCents })),
    ).toBe(
      'Use um valor como 1.200,00, ou deixe vazio para "Preço a combinar".',
    );
  });

  it("accepts an empty price", () => {
    expect(
      listingRequestSchema.safeParse({ ...listing, priceCents: null }).success,
    ).toBe(true);
  });

  it("asks for the invitee name and a long enough password", () => {
    expect(
      messageFor(
        acceptInviteRequestSchema.safeParse({
          name: " ",
          password: "x".repeat(10),
        }),
      ),
    ).toBe("Informe seu nome.");
    expect(
      messageFor(
        acceptInviteRequestSchema.safeParse({
          name: "Ana",
          password: "x".repeat(9),
        }),
      ),
    ).toBe("A senha precisa ter pelo menos 10 caracteres.");
  });

  it("validates login email and password", () => {
    expect(
      messageFor(loginRequestSchema.safeParse({ email: "a@b", password: "p" })),
    ).toBe("Informe um e-mail válido.");
    expect(
      messageFor(
        loginRequestSchema.safeParse({ email: "a@b.com", password: "" }),
      ),
    ).toBe("Informe sua senha.");
  });

  it("validates the invite email", () => {
    const check = (email: string) =>
      inviteRequestSchema.safeParse({ email, role: "seller" });
    expect(messageFor(check("sem-arroba"))).toBe("Informe um e-mail válido.");
    expect(messageFor(check("@b.com"))).toBe("Informe um e-mail válido.");
    expect(messageFor(check("a@@b.com"))).toBe("Informe um e-mail válido.");
    expect(check("  a@b.com ").success).toBe(true);
    expect(check("  a@b.co ").success).toBe(true);
    for (const invalid of ["a@b.", "a@.com", "a b@c.com", "a@b@c.com"]) {
      expect(messageFor(check(invalid))).toBe("Informe um e-mail válido.");
    }
  });

  it("asks for the store name", () => {
    expect(messageFor(storeRequestSchema.safeParse({ name: " " }))).toBe(
      "Informe o nome da loja.",
    );
  });

  it("asks for the member name", () => {
    expect(
      messageFor(sellerRequestSchema.safeParse({ displayName: " " })),
    ).toBe("Informe o nome.");
  });
});
