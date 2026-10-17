import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { DEFAULT_CATEGORIES } from "../default-categories";
import { Category } from "../entities/category.entity";
import { Store } from "../entities/store.entity";
import { StoreMember, type StoreRole } from "../entities/store-member.entity";

export interface StoreSettings {
  id: string;
  slug: string;
  name: string;
  headline: string;
  intro: string;
  locale: string;
  currency: string;
}

export interface CategoryResponse {
  id: string;
  slug: string;
  name: string;
}

export interface MeResponse {
  user: { id: string; name: string; email: string };
  memberships: Membership[];
}

export interface Membership {
  role: StoreRole;
  store: StoreSettings;
}

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly stores: Repository<Store>,
    @InjectRepository(StoreMember)
    private readonly members: Repository<StoreMember>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Create a store together with its default categories. */
  async create(
    manager: EntityManager,
    input: { slug: string; name: string; headline?: string; intro?: string },
  ): Promise<Store> {
    const store = await manager.getRepository(Store).save({
      slug: input.slug,
      name: input.name,
      headline: input.headline ?? "",
      intro: input.intro ?? "",
    });
    await manager.getRepository(Category).save(
      DEFAULT_CATEGORIES.map((category, position) => ({
        ...category,
        storeId: store.id,
        position,
      })),
    );
    return store;
  }

  /** The signed-in admin and the stores they can manage. */
  async me(userId: string): Promise<MeResponse> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    return {
      user: { id: user.id, name: user.name, email: user.email },
      memberships: await this.membershipsFor(userId),
    };
  }

  async membershipsFor(userId: string): Promise<Membership[]> {
    const rows = await this.members.find({
      where: { userId },
      relations: { store: true },
      order: { createdAt: "ASC" },
    });
    return rows.map((row) => ({
      role: row.role,
      store: toSettings(row.store),
    }));
  }

  async getSettings(storeId: string): Promise<StoreSettings> {
    return toSettings(await this.findOrFail(storeId));
  }

  async updateSettings(
    storeId: string,
    patch: Partial<Pick<Store, "name" | "headline" | "intro">>,
  ): Promise<StoreSettings> {
    const store = await this.findOrFail(storeId);
    Object.assign(store, patch);
    return toSettings(await this.stores.save(store));
  }

  async listCategories(storeId: string): Promise<CategoryResponse[]> {
    const rows = await this.categories.find({
      where: { storeId },
      order: { position: "ASC" },
    });
    return rows.map(({ id, slug, name }) => ({ id, slug, name }));
  }

  private async findOrFail(storeId: string): Promise<Store> {
    const store = await this.stores.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException();
    return store;
  }
}

function toSettings(store: Store): StoreSettings {
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    headline: store.headline,
    intro: store.intro,
    locale: store.locale,
    currency: store.currency,
  };
}
