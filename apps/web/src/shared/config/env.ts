import { z } from "zod";

/** Read a required server-side environment variable or fail loudly. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set`);
  return value;
}

const required = z.string().min(1);

/** A URL with a scheme and a host, which also rejects a platform reference that resolved to nothing, such as `https://`. */
const hostUrl = required.refine((value) => {
  try {
    return new URL(value).hostname !== "";
  } catch {
    return false;
  }
});

const envSchema = z.object({
  PORT: required,
  HOSTNAME: required,
  API_BASE_URL: hostUrl,
  PUBLIC_BASE_URL: hostUrl,
  INTERNAL_API_SECRET: required,
});

/** Names of required variables that are unset or unusable. Never returns values: secrets are in here. */
export function unusableEnv(): string[] {
  const result = envSchema.safeParse(process.env);
  if (result.success) return [];
  return [
    ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
  ];
}
