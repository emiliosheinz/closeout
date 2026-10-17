/**
 * Escape `%`, `_` and `\` so user search text is matched literally inside a
 * `LIKE ... ESCAPE '\'` pattern.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
