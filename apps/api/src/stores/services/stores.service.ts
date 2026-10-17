import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";
import { Listing } from "@/catalog/entities/listing.entity";
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

export interface DashboardCounts {
  published: number;
  available: number;
  reserved: number;
  sold: number;
  draft: number;
  archived: number;
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
    @InjectRepository(Listing)
    private readonly listings: Repository<Listing>,
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

  async dashboard(storeId: string): Promise<DashboardCounts> {
    const row = await this.listings
      .createQueryBuilder("l")
      .select(
        `COUNT(*) FILTER (WHERE l.publication = 'published')::int`,
        "published",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE l.publication = 'published' AND l.availability = 'available')::int`,
        "available",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE l.publication = 'published' AND l.availability = 'reserved')::int`,
        "reserved",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE l.publication = 'published' AND l.availability = 'sold')::int`,
        "sold",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE l.publication = 'draft')::int`,
        "draft",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE l.publication = 'archived')::int`,
        "archived",
      )
      .where("l.store_id = :storeId", { storeId })
      .getRawOne<DashboardCounts>();
    if (!row) throw new Error("Dashboard aggregate returned no row");
    return row;
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
