import type { NextFunction, Request, Response } from "express";
import { isInternalRequest } from "./internal-request";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence in depth on top of `SameSite=Lax`: every state-changing
 * request must come from the storefront's own origin. Server-to-server calls
 * from apps/web carry the internal secret instead of an Origin header.
 */
export function originCheck(publicBaseUrl: string) {
  const allowedOrigin = new URL(publicBaseUrl).origin;
  return (req: Request, res: Response, next: NextFunction): void => {
    const allowed =
      SAFE_METHODS.has(req.method) ||
      req.headers.origin === allowedOrigin ||
      isInternalRequest(req.headers);
    if (allowed) {
      next();
      return;
    }
    res.status(403).json({ statusCode: 403, message: "Forbidden" });
  };
}
