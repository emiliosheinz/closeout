import type {
  AssignableRole,
  Availability,
  Condition,
  Publication,
  StoreRole,
} from "@closeout/contracts/enums";

/*
 * Every user-facing label and number format lives here, so adding a locale
 * or currency later means touching this module, not the components.
 */

export const DEFAULT_LOCALE = "pt-BR";
export const DEFAULT_CURRENCY = "BRL";
/** Fixed so server and browser render the same calendar day. */
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

/** `null` means "a combinar"; zero is a real price ("grátis"). */
export function formatPrice(
  priceCents: number | null,
  locale = DEFAULT_LOCALE,
  currency = DEFAULT_CURRENCY,
): string {
  if (priceCents === null) return "Preço a combinar";
  if (priceCents === 0) return "Grátis";
  return new Intl.NumberFormat(locale, { style: "currency", currency })
    .format(priceCents / 100)
    .replace(/ /g, " ");
}

/** Short form for price stickers: whole reais drop the cents. */
export function formatStickerPrice(
  priceCents: number | null,
  locale = DEFAULT_LOCALE,
  currency = DEFAULT_CURRENCY,
): string {
  if (priceCents === null) return "A combinar";
  if (priceCents === 0) return "Grátis";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
  })
    .format(priceCents / 100)
    .replace(/\u00a0/g, " ");
}

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "Novo",
  like_new: "Como novo",
  good: "Bom estado",
  fair: "Com marcas de uso",
  for_parts: "Para conserto ou peças",
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
};

export const PUBLICATION_LABELS: Record<Publication, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export const AVAILABILITY_FILTER_LABELS = {
  listed: "À venda",
  available: "Disponíveis",
  reserved: "Reservados",
  sold: "Vendidos",
  all: "Todos",
} as const;

export const SORT_LABELS = {
  recent: "Mais recentes",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
} as const;

/** "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function joinNames(names: string[]): string {
  return new Intl.ListFormat(DEFAULT_LOCALE, {
    style: "long",
    type: "conjunction",
  }).format(names);
}

export function pluralize(count: number, one: string, many: string): string {
  return `${count.toLocaleString(DEFAULT_LOCALE)} ${count === 1 ? one : many}`;
}

export const ROLE_LABELS: Record<StoreRole, string> = {
  owner: "Dono(a)",
  admin: "Admin",
  seller: "Vendedor(a)",
};

/** What each role an invite can grant lets the person do. */
export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  admin: "Cuida da loja, da equipe e de todos os anúncios.",
  seller: "Cuida só dos próprios anúncios e do próprio contato.",
};

/** "30 de outubro de 2026". */
export function formatDate(
  iso: string,
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone,
  }).format(new Date(iso));
}

/** "30/10/2026", for table cells where the long form wraps. */
export function formatShortDate(
  iso: string,
  locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeZone,
  }).format(new Date(iso));
}
