const MAX_CENTS = 100_000_000;

/**
 * Parse a price typed the Brazilian way into cents: "1.200,50", "1200,5",
 * "R$ 80", "1200". A dot followed by exactly three digits is a thousands
 * separator; otherwise a lone dot is a decimal point. Returns null for
 * anything that is not a price.
 */
export function parsePriceToCents(input: string): number | null {
  let value = input.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(value)) return null;
  if (value.includes(",")) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}($|\.)/.test(value)) {
    value = value.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return cents <= MAX_CENTS ? cents : null;
}

/** Cents back to the editable "1200,50" form. */
export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  const reais = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0
    ? String(reais)
    : `${reais},${String(rest).padStart(2, "0")}`;
}
