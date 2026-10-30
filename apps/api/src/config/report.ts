import { writeSync } from "node:fs";
import type { z } from "zod";

/** Named sections, each a schema read from the whole environment. */
export type Scope = Record<string, z.ZodType>;

export type ScopeConfig<S extends Scope> = { [K in keyof S]: z.output<S[K]> };

export type ParsedEnv<S extends Scope> =
  | { ok: true; config: ScopeConfig<S> }
  | { ok: false; problems: string[] };

/**
 * Parses every section of `scope` from `env`, collecting one problem per
 * offending variable: its name and the rule it breaks, never its value. An
 * empty variable counts as unset.
 */
export function parseEnv<S extends Scope>(
  scope: S,
  env: NodeJS.ProcessEnv,
): ParsedEnv<S> {
  const set = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== ""),
  );
  const config: Record<string, unknown> = {};
  const problems = new Map<string, string>();
  for (const [section, schema] of Object.entries(scope)) {
    const result = schema.safeParse(set);
    if (result.success) {
      config[section] = result.data;
      continue;
    }
    for (const issue of result.error.issues) {
      const name = String(issue.path[0]);
      if (!problems.has(name)) problems.set(name, `${name} ${issue.message}`);
    }
  }
  if (problems.size > 0) return { ok: false, problems: [...problems.values()] };
  return { ok: true, config: config as ScopeConfig<S> };
}

/**
 * The entry points' config step: the parsed scope, or every problem written
 * to stderr and a non-zero exit before anything else runs.
 */
export function parseOrExit<S extends Scope>(
  scope: S,
  env: NodeJS.ProcessEnv = process.env,
): ScopeConfig<S> {
  const parsed = parseEnv(scope, env);
  if (parsed.ok) return parsed.config;
  // Synchronous, so the lines are out before the process exits.
  writeSync(
    2,
    `Invalid environment:\n${parsed.problems.map((line) => `  ${line}\n`).join("")}`,
  );
  process.exit(1);
}
