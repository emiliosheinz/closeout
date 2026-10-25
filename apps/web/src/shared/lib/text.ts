/** Lowercase and strip accents, so "Café" and "cafe" compare equal. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Whether `text` contains `query`, ignoring case and accents. */
export function matchesSearch(text: string, query: string): boolean {
  return normalizeSearch(text).includes(normalizeSearch(query));
}

const collator = new Intl.Collator("pt-BR");

/** pt-BR alphabetical order: accented letters sort with their base letter. */
export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}
