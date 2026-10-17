import type { DataSource, EntityManager } from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/auth/services/passwords";
import type { SessionsService } from "@/auth/services/sessions.service";
import { Seller } from "@/sellers/entities/seller.entity";
import { normalizeWhatsAppNumber } from "@/sellers/whatsapp-number";
import { Store } from "@/stores/entities/store.entity";
import { StoreMember } from "@/stores/entities/store-member.entity";
import type { StoresService } from "@/stores/services/stores.service";

export class CommandError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface StoreIdentity {
  slug: string;
  name: string;
}

/** Return the store with `slug`, creating it (with default categories) if missing. */
export async function ensureStore(
  manager: EntityManager,
  stores: StoresService,
  identity: StoreIdentity,
): Promise<Store> {
  if (!STORE_SLUG_PATTERN.test(identity.slug)) {
    throw new CommandError(
      `Invalid store slug "${identity.slug}": use lowercase letters, digits and dashes.`,
    );
  }
  const existing = await manager
    .getRepository(Store)
    .findOne({ where: { slug: identity.slug } });
  return existing ?? stores.create(manager, identity);
}

export interface CreateAdminInput {
  email: string;
  name: string;
  password: string;
  store: StoreIdentity;
  whatsapp?: string;
}

/**
 * Create an administrator, grant them the store (the first member becomes
 * its owner) and give them a seller profile buyers can contact. This is the
 * only way users are created: there is no registration endpoint.
 */
export async function createAdmin(
  dataSource: DataSource,
  stores: StoresService,
  input: CreateAdminInput,
): Promise<{ userId: string; storeId: string; role: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL_PATTERN.test(email)) throw new CommandError("Invalid email.");
  if (!name) throw new CommandError("Name is required.");
  assertPasswordStrength(input.password);
  const whatsappNumber =
    input.whatsapp === undefined ? null : parseWhatsApp(input.whatsapp);

  const passwordHash = await hashPassword(input.password);
  return dataSource.transaction(async (manager) => {
    const store = await ensureStore(manager, stores, input.store);
    if (await manager.getRepository(User).exists({ where: { email } })) {
      throw new CommandError(`A user with email ${email} already exists.`);
    }
    const user = await manager
      .getRepository(User)
      .save({ email, name, passwordHash });
    const hasMembers = await manager
      .getRepository(StoreMember)
      .exists({ where: { storeId: store.id } });
    const role = hasMembers ? "admin" : "owner";
    await manager
      .getRepository(StoreMember)
      .save({ storeId: store.id, userId: user.id, role });
    await manager.getRepository(Seller).save({
      storeId: store.id,
      userId: user.id,
      displayName: name,
      whatsappNumber,
      avatarKey: null,
    });
    return { userId: user.id, storeId: store.id, role };
  });
}

/** Replace a user's password and sign them out everywhere. */
export async function resetPassword(
  dataSource: DataSource,
  sessions: SessionsService,
  input: { email: string; password: string },
): Promise<void> {
  assertPasswordStrength(input.password);
  const email = input.email.trim().toLowerCase();
  const user = await dataSource
    .getRepository(User)
    .findOne({ where: { email } });
  if (!user) throw new CommandError(`No user with email ${email}.`);
  user.passwordHash = await hashPassword(input.password);
  await dataSource.getRepository(User).save(user);
  await sessions.revokeAllForUser(user.id);
}

function assertPasswordStrength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new CommandError(
      `Password must have at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
}

export function parseWhatsApp(input: string): string {
  const number = normalizeWhatsAppNumber(input);
  if (!number) {
    throw new CommandError(
      `Invalid WhatsApp number "${input}". Include the country code, e.g. +55 11 99999-8888.`,
    );
  }
  return number;
}
