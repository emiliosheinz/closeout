import type { Availability, Condition, Publication } from "./catalog/types";

/*
 * Every user-facing label and number format lives here, so adding a locale
 * or currency later means touching this module, not the components.
 */

export const DEFAULT_LOCALE = "pt-BR";
export const DEFAULT_CURRENCY = "BRL";

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

export const typeProbe: number = "x";
