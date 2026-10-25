import { requireEnv } from "@/shared/config/env";

export function apiUrl(path: string): string {
  return `${requireEnv("API_BASE_URL").replace(/\/$/, "")}${path}`;
}
