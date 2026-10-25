/** What the data layer needs from a contracts schema; zod schemas satisfy it. */
export interface Schema<T> {
  safeParse(
    data: unknown,
  ): { success: true; data: T } | { success: false; error: unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** An object with an `items` array, whose items are not looked at yet. */
export const itemsEnvelope: Schema<{ items: unknown[] }> = {
  safeParse(data) {
    if (isRecord(data) && Array.isArray(data.items)) {
      return { success: true, data: { items: data.items } };
    }
    return { success: false, error: new Error("Missing items array") };
  },
};

/** Items that match the schema; each one that does not is logged and left out. */
export function dropInvalid<T>(
  items: unknown[],
  schema: Schema<T>,
  source: string,
): T[] {
  const valid: T[] = [];
  for (const raw of items) {
    const result = schema.safeParse(raw);
    if (result.success) valid.push(result.data);
    else console.error(`Item from ${source} failed its schema`, result.error);
  }
  return valid;
}

/** Only the id of a created or copied resource. */
export const withId: Schema<{ id: string }> = {
  safeParse(data) {
    if (isRecord(data) && typeof data.id === "string") {
      return { success: true, data: { id: data.id } };
    }
    return { success: false, error: new Error("Missing id") };
  },
};

/** `{ items }` where every item must match. */
export function listOf<T>(item: Schema<T>): Schema<{ items: T[] }> {
  return {
    safeParse(data) {
      const envelope = itemsEnvelope.safeParse(data);
      if (!envelope.success) return envelope;
      const items: T[] = [];
      for (const raw of envelope.data.items) {
        const parsed = item.safeParse(raw);
        if (!parsed.success) return parsed;
        items.push(parsed.data);
      }
      return { success: true, data: { items } };
    },
  };
}
