import type { NextFunction, Request, Response } from "express";

/** Baseline hardening headers for every API response. */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Routes that serve cacheable content (media) override this in the handler.
  res.setHeader("Cache-Control", "no-store");
  next();
}
