import type {
  AdminListingDetail,
  AdminListingSummary,
  Category,
  Seller,
  StoreSettings,
} from "@closeout/contracts/schemas";

export const STORE: StoreSettings = {
  id: "store-1",
  slug: "loja-da-bia",
  name: "Loja da Bia",
  headline: "Tudo precisa sair",
  intro: "Mudança de casa.",
  locale: "pt-BR",
  currency: "BRL",
};

export const LISTING_ID = "0b6f1b44-6f3c-4b7a-8d3c-1f0a1c2d3e4f";

export const listingSummary = (
  overrides: Partial<AdminListingSummary> = {},
): AdminListingSummary => ({
  id: LISTING_ID,
  slug: "sofa-azul",
  title: "Sofá azul",
  priceCents: 120000,
  condition: "good",
  availability: "available",
  publication: "published",
  category: { id: "cat-1", name: "Móveis" },
  sellers: [{ id: "s-ana", displayName: "Ana" }],
  coverUrl: null,
  imageCount: 0,
  updatedAt: "2026-10-17T12:00:00.000Z",
  ...overrides,
});

export const listingDetail = (
  overrides: Partial<AdminListingDetail> = {},
): AdminListingDetail => ({
  ...listingSummary(),
  description: "Sofá de três lugares.",
  attributes: [],
  images: [],
  ...overrides,
});

export const category: Category = {
  id: "cat-1",
  slug: "moveis",
  name: "Móveis",
};

export const seller = (id: string, displayName: string): Seller => ({
  id,
  displayName,
  whatsappNumber: "5511988887777",
  avatarUrl: null,
  listingCount: 1,
  userId: `u-${id}`,
});

/** The `/me` response for a member of `STORE`; `sellerId` is the member's own contact profile. */
export const meResponse = (
  role: "owner" | "admin" | "seller" = "owner",
  user = { id: "u-ana", name: "Ana", email: "ana@loja.test" },
  sellerId = "s-ana",
) => ({ user, memberships: [{ role, sellerId, store: STORE }] });
