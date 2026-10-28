import type { StoreRole } from "@closeout/contracts/enums";
import { FORBIDDEN } from "@closeout/contracts/schemas";
import {
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppException } from "@/problem/app-exception";

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

/**
 * Roles allowed to call a store-scoped handler. `StoreMemberGuard` refuses
 * every handler that does not declare them.
 */
export const Roles = Reflector.createDecorator<readonly StoreRole[]>();

export function forbidden(): AppException {
  return new AppException(HttpStatus.FORBIDDEN, FORBIDDEN);
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
