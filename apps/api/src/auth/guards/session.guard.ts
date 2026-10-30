import { UNAUTHORIZED } from "@closeout/contracts/schemas";
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { AppException } from "@/problem/app-exception";
import { SessionsService } from "../services/sessions.service";
import { readSessionCookie } from "../session-cookie";

/** Authenticated principal attached to the request by {@link SessionGuard}. */
export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
}

export interface RequestWithPrincipal {
  principal?: AuthenticatedPrincipal;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Guard for every administrator endpoint. Rejects with 401 when the
 * session cookie is missing, unknown, revoked or expired.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const rawToken = readSessionCookie(request.headers.cookie);
    if (!rawToken) throw unauthorized();

    const session = await this.sessions.findActiveByRawToken(rawToken);
    if (!session) throw unauthorized();

    request.principal = { userId: session.userId, sessionId: session.id };
    return true;
  }
}

/** Read the principal a {@link SessionGuard} attached; throws if absent. */
export function requirePrincipal(
  request: RequestWithPrincipal,
): AuthenticatedPrincipal {
  if (!request.principal) throw unauthorized();
  return request.principal;
}

function unauthorized(): AppException {
  return new AppException(HttpStatus.UNAUTHORIZED, UNAUTHORIZED);
}
