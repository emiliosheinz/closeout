import { parseRequest, uuidSchema } from "@closeout/contracts/schemas";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import {
  isManager,
  type RequestWithMembership,
  requireMembership,
} from "@/stores/membership";
import { ListingsService, listingNotFound } from "../services/listings.service";

/**
 * Runs after `StoreMemberGuard` on the listing routes. On a route addressing
 * one listing (`:id`), a seller whose contact profile is not assigned to it
 * gets the same 404 as for an id that does not exist, photo routes included.
 */
@Injectable()
export class AssignedListingGuard implements CanActivate {
  constructor(private readonly listings: ListingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithMembership & { params: Record<string, string> }>();
    const member = requireMembership(request);
    if (!("id" in request.params) || isManager(member.role)) return true;
    const id = request.params.id;
    if (
      !parseRequest(uuidSchema, id).success ||
      !(await this.listings.isVisibleTo(member, id))
    ) {
      throw listingNotFound();
    }
    return true;
  }
}
