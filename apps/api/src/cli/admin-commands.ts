import type { StoreRole } from "@closeout/contracts/enums";
import type { DataSource, EntityManager } from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/auth/services/passwords";
import type { SessionsService } from "@/auth/services/sessions.service";
import { normalizeWhatsAppNumber } from "@/sellers/whatsapp-number";
import { Store } from "@/stores/entities/store.entity";
import {
  isLongEnoughPassword,
  parseEmail,
  parseName,
} from "@/stores/member-input";
import { provisionMember } from "@/stores/member-provisioning";
import type { StoresService } from "@/stores/services/stores.service";

export class CommandError extends Error {}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface StoreIdentity {
  slug: string;
  /** Only used when the store does not exist yet. */
  name?: string;
}

/** Return the store with `slug`, creating it (with default categories) if missing. */
export async function ensureStore(
  manager: EntityManager,
  stores: StoresService,
  identity: StoreIdentity,
): Promise<Store> {
  if (!SLUG_PATTERN.test(identity.slug)) {
    throw new CommandError(
      `Invalid store slug "${identity.slug}": use lowercase letters, digits and dashes.`,
    );
  }
  const existing = await manager
    .getRepository(Store)
    .findOne({ where: { slug: identity.slug } });
  if (existing) return existing;
  const name = identity.name?.trim();
  if (!name) {
    throw new CommandError(
      `Store "${identity.slug}" does not exist; pass --store-name to create it.`,
    );
  }
  return stores.create(manager, { slug: identity.slug, name });
}

export interface CreateAdminInput {
  email: string;
  name: string;
  password: string;
  store: StoreIdentity;
  whatsapp?: string;
}

/**
 * Create a member of the store (the first one becomes its owner, later ones
 * admins) with a contact profile buyers can reach. Besides accepting an
 * invite, this is the only way users are created.
 */
export async function createAdmin(
  dataSource: DataSource,
  stores: StoresService,
  input: CreateAdminInput,
): Promise<{ userId: string; storeId: string; role: StoreRole }> {
  const email = parseEmail(input.email);
  const name = parseName(input.name);
  if (!email) throw new CommandError("Invalid email.");
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
    const member = await provisionMember(manager, {
      storeId: store.id,
      email,
      name,
      passwordHash,
      whatsappNumber,
    });
    return { userId: member.userId, storeId: store.id, role: member.role };
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
  const passwordHash = await hashPassword(input.password);
  await dataSource.transaction(async (manager) => {
    const user = await manager
      .getRepository(User)
      .findOne({ where: { email } });
    if (!user) throw new CommandError(`No user with email ${email}.`);
    await manager.getRepository(User).update({ id: user.id }, { passwordHash });
    await sessions.revokeAllForUser(user.id, manager);
  });
}

function assertPasswordStrength(password: string): void {
  if (!isLongEnoughPassword(password)) {
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
