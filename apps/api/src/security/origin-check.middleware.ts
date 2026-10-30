import { ORIGIN_FORBIDDEN } from "@closeout/contracts/schemas";
import { HttpStatus } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { Secret } from "@/config/secret";
import { AppException } from "@/problem/app-exception";
import { isInternalRequest } from "./internal-request";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence in depth on top of `SameSite=Lax`: every state-changing
 * request must come from the storefront's own origin. Server-to-server calls
 * from apps/web carry the internal secret instead of an Origin header.
 */
export function originCheck(publicBaseUrl: string, internalSecret: Secret) {
  const allowedOrigin = new URL(publicBaseUrl).origin;
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allowed =
      SAFE_METHODS.has(req.method) ||
      req.headers.origin === allowedOrigin ||
      isInternalRequest(req.headers, internalSecret);
    if (allowed) {
      next();
      return;
    }
    next(new AppException(HttpStatus.FORBIDDEN, ORIGIN_FORBIDDEN));
  };
}
