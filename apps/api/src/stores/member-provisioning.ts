import type { EntityManager } from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { Seller } from "@/sellers/entities/seller.entity";
import { StoreMember, type StoreRole } from "./entities/store-member.entity";

export interface NewMember {
  storeId: string;
  /** Already parsed with `parseEmail`. */
  email: string;
  /** Already parsed with `parseName`; also the contact profile's name. */
  name: string;
  passwordHash: string;
  /** International digits, or null for no WhatsApp. */
  whatsappNumber: string | null;
  /**
   * Used as given. Without it the store's first member becomes its owner
   * and later ones admins.
   */
  role?: StoreRole;
}

export interface ProvisionedMember {
  userId: string;
  sellerId: string;
  role: StoreRole;
}

/**
 * The only way a member comes to exist: creates the user, their membership
 * and exactly one contact profile, inside the caller's transaction.
 */
export async function provisionMember(
  manager: EntityManager,
  input: NewMember,
): Promise<ProvisionedMember> {
  const role =
    input.role ??
    ((await manager
      .getRepository(StoreMember)
      .exists({ where: { storeId: input.storeId, role: "owner" } }))
      ? "admin"
      : "owner");
  const user = await manager.getRepository(User).save({
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
  });
  await manager
    .getRepository(StoreMember)
    .save({ storeId: input.storeId, userId: user.id, role });
  const seller = await manager.getRepository(Seller).save({
    storeId: input.storeId,
    userId: user.id,
    displayName: input.name,
    whatsappNumber: input.whatsappNumber,
    avatarKey: null,
  });
  return { userId: user.id, sellerId: seller.id, role };
}
