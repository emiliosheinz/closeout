import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, type EntityManager, Repository } from "typeorm";
import { MediaService } from "@/media/media.service";
import { mediaUrls } from "@/media/media-urls";
import { Seller } from "@/sellers/entities/seller.entity";
import { Category } from "@/stores/entities/category.entity";
import { Listing } from "../entities/listing.entity";
import { ListingImage } from "../entities/listing-image.entity";
import { canPublish, PUBLISH_REQUIRES_PHOTO } from "../listing-rules";
import type {
  Availability,
  Condition,
  ListingAttribute,
  Publication,
} from "../listing-status";
import { type PublicListingDetail, toPublicDetail } from "../public-mappers";
import { listingSlug } from "../slug";
import { escapeLike } from "../sql";

export interface AdminImage {
  id: string;
  position: number;
  width: number;
  height: number;
  urls: { sm: string; lg: string };
}

export interface AdminListingSummary {
  id: string;
  slug: string;
  title: string;
  priceCents: number | null;
  condition: Condition;
  availability: Availability;
  publication: Publication;
  category: { id: string; name: string };
  seller: { id: string; displayName: string };
  coverUrl: string | null;
  imageCount: number;
  updatedAt: string;
}

export interface AdminListingDetail extends AdminListingSummary {
  description: string;
  attributes: ListingAttribute[];
  images: AdminImage[];
}

export interface ListingInput {
  title?: string;
  description?: string;
  categoryId?: string;
  sellerId?: string;
  priceCents?: number | null;
  condition?: Condition;
  attributes?: ListingAttribute[];
  availability?: Availability;
  publication?: Publication;
}

const COPY_SUFFIX = " (cópia)";

@Injectable()
export class ListingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Listing)
    private readonly listings: Repository<Listing>,
    private readonly media: MediaService,
  ) {}

  async list(storeId: string, q?: string): Promise<AdminListingSummary[]> {
    const query = this.listings
      .createQueryBuilder("l")
      .innerJoinAndSelect("l.category", "category")
      .innerJoinAndSelect("l.seller", "seller")
      .leftJoinAndSelect("l.images", "image")
      .where("l.store_id = :storeId", { storeId })
      .orderBy("l.updated_at", "DESC")
      .addOrderBy("image.position", "ASC");
    if (q) {
      query.andWhere(
        `unaccent(lower(l.title)) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'`,
        { q: escapeLike(q) },
      );
    }
    const rows = await query.getMany();
    return rows.map(toSummary);
  }

  async get(storeId: string, id: string): Promise<AdminListingDetail> {
    return toDetail(
      await this.findWithRelations(this.dataSource.manager, storeId, id),
    );
  }

  async preview(storeId: string, id: string): Promise<PublicListingDetail> {
    const listing = await this.findWithRelations(
      this.dataSource.manager,
      storeId,
      id,
    );
    return toPublicDetail(listing, []);
  }

  async create(
    storeId: string,
    input: Required<
      Pick<ListingInput, "title" | "categoryId" | "sellerId" | "condition">
    > &
      ListingInput,
  ): Promise<AdminListingDetail> {
    return this.dataSource.transaction(async (manager) => {
      await assertReferencesBelongToStore(manager, storeId, input);
      const saved = await manager.getRepository(Listing).save({
        storeId,
        slug: listingSlug(input.title),
        title: input.title,
        description: input.description ?? "",
        categoryId: input.categoryId,
        sellerId: input.sellerId,
        priceCents: input.priceCents ?? null,
        condition: input.condition,
        attributes: input.attributes ?? [],
        availability: "available",
        publication: "draft",
        publishedAt: null,
      });
      return toDetail(await this.findWithRelations(manager, storeId, saved.id));
    });
  }

  async update(
    storeId: string,
    id: string,
    patch: ListingInput,
  ): Promise<AdminListingDetail> {
    return this.dataSource.transaction(async (manager) => {
      const listing = await this.findWithRelations(manager, storeId, id);
      await assertReferencesBelongToStore(manager, storeId, patch);

      if (patch.publication === "published") {
        if (!canPublish(listing.images.length)) {
          throw new UnprocessableEntityException(PUBLISH_REQUIRES_PHOTO);
        }
        listing.publishedAt ??= new Date();
      }

      const {
        images: _images,
        category: _category,
        seller: _seller,
        ...row
      } = listing;
      await manager.getRepository(Listing).save({
        ...row,
        ...definedOnly(patch),
      });
      return toDetail(await this.findWithRelations(manager, storeId, id));
    });
  }

  /** Copy a listing into a new draft without photos. */
  async duplicate(storeId: string, id: string): Promise<AdminListingDetail> {
    return this.dataSource.transaction(async (manager) => {
      const source = await this.findWithRelations(manager, storeId, id);
      const title = `${source.title.slice(0, 120 - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
      const copy = await manager.getRepository(Listing).save({
        storeId,
        slug: listingSlug(source.title),
        title,
        description: source.description,
        categoryId: source.categoryId,
        sellerId: source.sellerId,
        priceCents: source.priceCents,
        condition: source.condition,
        attributes: source.attributes,
        availability: "available",
        publication: "draft",
        publishedAt: null,
      });
      return toDetail(await this.findWithRelations(manager, storeId, copy.id));
    });
  }

  async remove(storeId: string, id: string): Promise<void> {
    const keys = await this.dataSource.transaction(async (manager) => {
      const listing = await this.findWithRelations(manager, storeId, id);
      await manager.getRepository(Listing).delete({ id: listing.id, storeId });
      return listing.images.map((image) => image.storageKey);
    });
    for (const key of keys) await this.media.remove(key);
  }

  private async findWithRelations(
    manager: EntityManager,
    storeId: string,
    id: string,
  ): Promise<Listing> {
    const listing = await manager.getRepository(Listing).findOne({
      where: { id, storeId },
      relations: { category: true, seller: true, images: true },
      order: { images: { position: "ASC" } },
    });
    if (!listing) throw new NotFoundException("Anúncio não encontrado.");
    return listing;
  }
}

/**
 * Seller and category ids arrive in the request body, so they must be
 * checked against the store explicitly; the store-member guard only covers
 * ids in the path.
 */
async function assertReferencesBelongToStore(
  manager: EntityManager,
  storeId: string,
  input: Pick<ListingInput, "sellerId" | "categoryId">,
): Promise<void> {
  if (
    input.sellerId !== undefined &&
    !(await manager
      .getRepository(Seller)
      .exists({ where: { id: input.sellerId, storeId } }))
  ) {
    throw new UnprocessableEntityException("Vendedor inválido.");
  }
  if (
    input.categoryId !== undefined &&
    !(await manager
      .getRepository(Category)
      .exists({ where: { id: input.categoryId, storeId } }))
  ) {
    throw new UnprocessableEntityException("Categoria inválida.");
  }
}

function definedOnly(patch: ListingInput): Partial<Listing> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<Listing>;
}

function toAdminImage(image: ListingImage): AdminImage {
  const urls = mediaUrls(image.storageKey);
  return {
    id: image.id,
    position: image.position,
    width: image.width,
    height: image.height,
    urls: { sm: urls.sm, lg: urls.lg },
  };
}

function toSummary(listing: Listing): AdminListingSummary {
  const cover = listing.images[0];
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    priceCents: listing.priceCents,
    condition: listing.condition,
    availability: listing.availability,
    publication: listing.publication,
    category: { id: listing.category.id, name: listing.category.name },
    seller: { id: listing.seller.id, displayName: listing.seller.displayName },
    coverUrl: cover ? mediaUrls(cover.storageKey).sm : null,
    imageCount: listing.images.length,
    updatedAt: listing.updatedAt.toISOString(),
  };
}

function toDetail(listing: Listing): AdminListingDetail {
  return {
    ...toSummary(listing),
    description: listing.description,
    attributes: listing.attributes,
    images: listing.images.map(toAdminImage),
  };
}
