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
 * Last hop of X-Forwarded-For: the address appended by the proxy closest to
 * this server. Earlier hops are client-supplied and could be forged to dodge
 * the login rate limit.
 */
export function clientIpFrom(forwardedFor: string | null): string | null {
  const last = forwardedFor?.split(",").at(-1)?.trim();
  return last ? last : null;
}
