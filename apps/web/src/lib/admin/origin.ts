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
 * Last hop of X-Forwarded-For. Trustworthy only behind a reverse proxy that
 * sets the header itself (overwriting or appending the real peer address);
 * without one, Next.js keeps whatever the client sent, and the per-client
 * login limit can be dodged (the per-email limit still applies).
 */
export function clientIpFrom(forwardedFor: string | null): string | null {
  const last = forwardedFor?.split(",").at(-1)?.trim();
  return last ? last : null;
}
