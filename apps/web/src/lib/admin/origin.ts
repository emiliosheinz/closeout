/**
 * True when a state-changing request comes from the storefront itself.
 * Browsers always send Origin on POST, so a missing header is refused too.
 */
export function isSameOrigin(
  originHeader: string | null,
  publicBaseUrl: string,
): boolean {
  if (!originHeader) return false;
  return originHeader === new URL(publicBaseUrl).origin;
}

/**
 * The visitor's address from X-Real-IP. Railway's edge overwrites that
 * header with the connecting client, so a value the client sends never
 * arrives. The last X-Forwarded-For hop there is an edge node shared by every
 * visitor, which would turn the per-IP login limit into a global lockout.
 * Any other host must sit behind a proxy that sets X-Real-IP the same way;
 * without one the per-client limit can be dodged (the per-email limit still
 * applies).
 */
export function clientIpFrom(realIp: string | null): string | null {
  const ip = realIp?.trim();
  return ip ? ip : null;
}
