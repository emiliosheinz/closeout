import { FORBIDDEN, NO_CLIENT_IP } from "@closeout/contracts/schemas";
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  APP_CONFIG,
  type AppModuleConfig,
  internalSecret,
} from "@/config/config.module";
import { AppException } from "@/problem/app-exception";
import { isInternalRequest, trustedClientIp } from "./internal-request";

export interface RequestWithClientIp {
  clientIp?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Admits only calls from apps/web that forward the visitor's IP, before
 * the body is parsed or any rate limit is consulted, and attaches that IP.
 */
@Injectable()
export class InternalRequestGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppModuleConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithClientIp>();
    const secret = internalSecret(this.config);
    if (!isInternalRequest(request.headers, secret)) {
      throw new AppException(HttpStatus.FORBIDDEN, FORBIDDEN);
    }
    // Without the visitor's IP every attempt would share one rate-limit
    // bucket, letting anyone lock everyone else out.
    const clientIp = trustedClientIp(request.headers, secret);
    if (!clientIp) {
      throw new AppException(HttpStatus.BAD_REQUEST, NO_CLIENT_IP);
    }
    request.clientIp = clientIp;
    return true;
  }
}

/** Read the client IP an {@link InternalRequestGuard} attached. */
export function requireClientIp(request: RequestWithClientIp): string {
  if (!request.clientIp) {
    throw new Error("InternalRequestGuard must run before reading the IP");
  }
  return request.clientIp;
}
