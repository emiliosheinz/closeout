import type { StoreRole } from "@closeout/contracts/enums";
import {
  acceptInviteRequestSchema,
  inviteRequestSchema,
  parseRequest,
  whatsappInputSchema,
} from "@closeout/contracts/schemas";
import type { DataSource, EntityManager } from "typeorm";
import type { z } from "zod";
import { User } from "@/auth/entities/user.entity";
import { hashPassword } from "@/auth/services/passwords";
import type { SessionsService } from "@/auth/services/sessions.service";
import { Store } from "@/stores/entities/store.entity";
import { provisionMember } from "@/stores/member-provisioning";
import type { StoresService } from "@/stores/services/stores.service";

export class CommandError extends Error {}

/** A new member's fields, with the rules and messages the API applies. */
const newMemberSchema = acceptInviteRequestSchema
  .omit({ token: true })
  .extend({ email: inviteRequestSchema.shape.email });

/** Parse operator input as the API would, failing with its first message. */
function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = parseRequest(schema, input);
  if (!result.success) {
    throw new CommandError(result.error.issues[0]?.message);
  }
  return result.data;
}

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
  const { email, name, password, whatsappNumber } = parseInput(
    newMemberSchema,
    {
      email: input.email,
      name: input.name,
      password: input.password,
      whatsappNumber: input.whatsapp,
    },
  );

  const passwordHash = await hashPassword(password);
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
      whatsappNumber: whatsappNumber ?? null,
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
  const password = parseInput(
    acceptInviteRequestSchema.shape.password,
    input.password,
  );
  const email = parseInput(inviteRequestSchema.shape.email, input.email);
  const passwordHash = await hashPassword(password);
  await dataSource.transaction(async (manager) => {
    const user = await manager
      .getRepository(User)
      .findOne({ where: { email } });
    if (!user) throw new CommandError(`No user with email ${email}.`);
    await manager.getRepository(User).update({ id: user.id }, { passwordHash });
    await sessions.revokeAllForUser(user.id, manager);
  });
}

export function parseWhatsApp(input: string): string {
  return parseInput(whatsappInputSchema, input);
}
