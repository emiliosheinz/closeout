import type { z } from "zod";
import { INVALID_VALUE, REQUIRED_FIELD, UNKNOWN_FIELD } from "./problem";

/** pt-BR message for any issue whose rule declares none of its own. */
function fallbackMessage(issue: z.core.$ZodRawIssue): string {
  if (issue.code === "unrecognized_keys") return UNKNOWN_FIELD;
  if (issue.code === "invalid_type" && issue.input === undefined) {
    return REQUIRED_FIELD;
  }
  return INVALID_VALUE;
}

/**
 * The one way to parse request input against a contracts request schema:
 * messages the schema leaves unset get pt-BR fallbacks instead of Zod's
 * English defaults. Returns the parsed output or the issues.
 */
export function parseRequest<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.ZodSafeParseResult<z.output<Schema>> {
  return schema.safeParse(input, { error: fallbackMessage });
}
