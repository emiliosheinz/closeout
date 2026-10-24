/** Read a required server-side environment variable or fail loudly. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set`);
  return value;
}

const REQUIRED_ENV = [
  "PORT",
  "HOSTNAME",
  "API_BASE_URL",
  "PUBLIC_BASE_URL",
  "INTERNAL_API_SECRET",
] as const;

const URL_ENV = new Set<string>(["API_BASE_URL", "PUBLIC_BASE_URL"]);

/**
 * Names of required variables that are unset or unusable. URLs must carry a
 * scheme and a host, which also catches a platform reference that resolved
 * to nothing, such as `https://`. Never returns values: secrets are in here.
 */
export function unusableEnv(): string[] {
  return REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    if (!value) return true;
    return URL_ENV.has(name) && !hasHost(value);
  });
}

function hasHost(value: string): boolean {
  try {
    return new URL(value).hostname !== "";
  } catch {
    return false;
  }
}
