import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
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
 * Guard for every administrator endpoint. Rejects with a bare 401 when the
 * session cookie is missing, unknown, revoked or expired.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const rawToken = readSessionCookie(request.headers.cookie);
    if (!rawToken) throw new UnauthorizedException();

    const session = await this.sessions.findActiveByRawToken(rawToken);
    if (!session) throw new UnauthorizedException();

    request.principal = { userId: session.userId, sessionId: session.id };
    return true;
  }
}

/** Read the principal a {@link SessionGuard} attached; throws if absent. */
export function requirePrincipal(
  request: RequestWithPrincipal,
): AuthenticatedPrincipal {
  if (!request.principal) throw new UnauthorizedException();
  return request.principal;
}
