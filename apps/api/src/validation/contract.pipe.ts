import { type FieldError, parseRequest } from "@closeout/contracts/schemas";
import {
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import type { z } from "zod";
import { ValidationProblem } from "@/problem/validation-problem";

const POINTER_ROOT: Partial<Record<ArgumentMetadata["type"], string>> = {
  body: "",
  query: "/query",
  param: "/params",
};

function escapeSegment(segment: PropertyKey): string {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointer(root: string, path: readonly PropertyKey[]): string {
  return root + path.map((segment) => `/${escapeSegment(segment)}`).join("");
}

/** JSON bodies may carry an own `__proto__` key; it never reaches a handler. */
function stripProtoKeys(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.hasOwn(value, "__proto__")) {
    delete (value as { __proto__?: unknown }).__proto__;
  }
  for (const child of Object.values(value)) stripProtoKeys(child);
}

/** One error per failing field (its first issue), one per unknown key. */
function fieldErrors(issues: z.core.$ZodIssue[], root: string): FieldError[] {
  const errors = new Map<string, string>();
  for (const issue of issues) {
    const paths =
      issue.code === "unrecognized_keys"
        ? issue.keys.map((key) => [...issue.path, key])
        : [issue.path];
    for (const path of paths) {
      const at = pointer(root, path);
      if (!errors.has(at)) errors.set(at, issue.message);
    }
  }
  return [...errors].map(([at, detail]) => ({ pointer: at, detail }));
}

/**
 * Validates every body, query or route param whose route declares a
 * contracts schema, through the contracts parse entry, and hands the
 * handler the parsed output. Arguments without a schema pass through.
 */
@Injectable()
export class ContractPipe implements PipeTransform {
  transform(value: unknown, { type, data, schema }: ArgumentMetadata): unknown {
    const location = POINTER_ROOT[type];
    if (!schema || location === undefined) return value;
    if (schema["~standard"].vendor !== "zod") {
      throw new Error(
        "Route schemas must be Zod schemas (parsed through parseRequest)",
      );
    }
    const input = type === "body" && !data && value === undefined ? {} : value;
    stripProtoKeys(input);
    const result = parseRequest(schema as z.ZodType, input);
    if (result.success) return result.data;
    const root = data ? `${location}/${escapeSegment(data)}` : location;
    throw new ValidationProblem(fieldErrors(result.error.issues, root));
  }
}
