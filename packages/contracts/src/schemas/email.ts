import { z } from "zod";

export const INVALID_EMAIL = "Informe um e-mail válido.";

/** Trimmed, one `@` with text before it and a dotted domain after it. */
export const emailSchema = z
  .string(INVALID_EMAIL)
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, INVALID_EMAIL);
