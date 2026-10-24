import {
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { StoreRole } from "./roles";

export { ANY_MEMBER, isManager, MANAGERS } from "./roles";

/** The caller as a member of the store addressed by the route. */
export interface MembershipContext {
  storeId: string;
  userId: string;
  role: StoreRole;
  /** The caller's own contact profile in this store. */
  sellerId: string;
}

export interface RequestWithMembership {
  membership?: MembershipContext;
}

export const FORBIDDEN = "Você não tem permissão para esta ação.";

/**
 * Roles allowed to call a store-scoped handler. `StoreMemberGuard` refuses
 * every handler that does not declare them.
 */
export const Roles = Reflector.createDecorator<readonly StoreRole[]>();

export function forbidden(): ForbiddenException {
  return new ForbiddenException(FORBIDDEN);
}

/** Read the membership a `StoreMemberGuard` attached; throws if absent. */
export function requireMembership(
  request: RequestWithMembership,
): MembershipContext {
  if (!request.membership) {
    throw new Error("StoreMemberGuard did not run for this route");
  }
  return request.membership;
}

/** Handler parameter carrying the caller's {@link MembershipContext}. */
export const CurrentMember = createParamDecorator(
  (_: unknown, context: ExecutionContext): MembershipContext =>
    requireMembership(context.switchToHttp().getRequest()),
);
