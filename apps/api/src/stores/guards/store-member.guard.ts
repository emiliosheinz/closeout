import type { StoreRole } from "@closeout/contracts/enums";
import {
  NOT_FOUND,
  parseRequest,
  uuidSchema,
} from "@closeout/contracts/schemas";
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import {
  type RequestWithPrincipal,
  requirePrincipal,
} from "@/auth/guards/session.guard";
import { AppException } from "@/problem/app-exception";
import { forbidden, type RequestWithMembership, Roles } from "../membership";

/**
 * Runs after `SessionGuard` on every `/stores/:storeId/*` route. A store the
 * principal is not a member of answers 404, exactly like a store that does
 * not exist, so ids of other tenants cannot be probed. Members are refused
 * unless the handler declares their role with `@Roles`; a handler without a
 * declaration is refused for everyone. Re-read on every request, so role
 * changes and removals apply immediately.
 */
@Injectable()
export class StoreMemberGuard implements CanActivate {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        RequestWithPrincipal &
          RequestWithMembership & { params: Record<string, string> }
      >();
    const storeIdParam = parseRequest(uuidSchema, request.params.storeId);
    if (!storeIdParam.success) throw notFound();
    const storeId = storeIdParam.data;

    const { userId } = requirePrincipal(request);
    const [member] = await this.dataSource.query<
      { role: StoreRole; sellerId: string }[]
    >(
      `SELECT m.role, s.id AS "sellerId"
         FROM store_members m
         JOIN sellers s ON s.store_id = m.store_id AND s.user_id = m.user_id
        WHERE m.store_id = $1 AND m.user_id = $2`,
      [storeId, userId],
    );
    if (!member) throw notFound();

    const allowed = this.reflector.get(Roles, context.getHandler());
    if (!allowed?.includes(member.role)) throw forbidden();

    request.membership = { storeId, userId, ...member };
    return true;
  }
}

function notFound(): AppException {
  return new AppException(HttpStatus.NOT_FOUND, NOT_FOUND);
}
