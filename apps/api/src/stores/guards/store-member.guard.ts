import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isUUID } from "class-validator";
import type { Repository } from "typeorm";
import {
  type RequestWithPrincipal,
  requirePrincipal,
} from "@/auth/guards/session.guard";
import { StoreMember } from "../entities/store-member.entity";

/**
 * Runs after `SessionGuard` on every `/stores/:storeId/*` route. A store the
 * principal is not a member of answers 404, exactly like a store that does
 * not exist, so ids of other tenants cannot be probed.
 */
@Injectable()
export class StoreMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(StoreMember)
    private readonly members: Repository<StoreMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithPrincipal & { params: Record<string, string> }>();
    const storeId = request.params.storeId;
    if (!storeId || !isUUID(storeId)) throw new NotFoundException();

    const { userId } = requirePrincipal(request);
    const member = await this.members.exists({ where: { storeId, userId } });
    if (!member) throw new NotFoundException();
    return true;
  }
}
