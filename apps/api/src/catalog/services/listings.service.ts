import type {
  Availability,
  Condition,
  Publication,
} from "@closeout/contracts/enums";
import type {
  AdminListingDetail,
  AdminListingSummary,
  DashboardCounts,
  ListingSaleRequest,
  ListingStatusRequest,
  PublicListingDetail,
} from "@closeout/contracts/schemas";
import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import {
  DataSource,
  type EntityManager,
  In,
  QueryFailedError,
  Repository,
} from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { BUYER_NOT_IN_STORE, resolveBuyer } from "@/buyers/resolve-buyer";
import { MediaService } from "@/media/media.service";
import { mediaUrls } from "@/media/media-urls";
import { AppException } from "@/problem/app-exception";
import { withConflicts } from "@/problem/db-conflicts";
import { Seller } from "@/sellers/entities/seller.entity";
import { Category } from "@/stores/entities/category.entity";
import { forbidden, type MembershipContext } from "@/stores/membership";
import { toAdminImage, toAdminSale } from "../admin-mappers";
import { Listing } from "../entities/listing.entity";
import { ListingImage } from "../entities/listing-image.entity";
import { ListingSeller } from "../entities/listing-seller.entity";
import { visibleListings } from "../listing-queries";
import {
  canEditSale,
  canPublish,
  canSetSellers,
  PUBLISH_REQUIRES_PHOTO,
  SALE_CHANGED,
  type SaleTransition,
  saleAfterFullUpdate,
  saleTransition,
  sellersForNewListing,
} from "../listing-rules";
import type { ListingAttribute } from "../listing-types";
import { listingSellers, toPublicDetail } from "../public-mappers";
import { listingSlug } from "../slug";
import { escapeLike } from "../sql";

export interface ListingInput {
  title?: string;
  description?: string;
  categoryId?: string;
  sellerIds?: string[];
  priceCents?: number | null;
  condition?: Condition;
  attributes?: ListingAttribute[];
  availability?: Availability;
  publication?: Publication;
}

/** Whoever writes listings: a member, or the demo seed acting as the owner. */
export type ListingActor = Pick<
  MembershipContext,
  "storeId" | "role" | "sellerId"
>;

const LISTING_NOT_FOUND = "Anúncio não encontrado.";

export function listingNotFound(): AppException {
  return new AppException(HttpStatus.NOT_FOUND, LISTING_NOT_FOUND);
}
const INVALID_SELLER = "Vendedor inválido.";
const INVALID_CATEGORY = "Categoria inválida.";
const NO_SELLER_CHOSEN = "Escolha ao menos um vendedor.";
const SALE_FIELDS_NEED_BUYER =
  "Informe o comprador para registrar os dados da venda.";
const AVAILABLE_HAS_NO_BUYER = "Um anúncio disponível não tem comprador.";
const EDIT_NEEDS_BUYER = "Informe o comprador da venda.";
const COPY_SUFFIX = " (cópia)";

@Injectable()
export class ListingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Listing)
    private readonly listings: Repository<Listing>,
    private readonly media: MediaService,
  ) {}

  /**
   * Whether the listing is in the actor's store and within their reach:
   * managers reach every listing, sellers only those assigned to them.
   */
  async isVisibleTo(actor: ListingActor, id: string): Promise<boolean> {
    return visibleListings(this.listings, actor)
      .andWhere("l.id = :id", { id })
      .getExists();
  }

  async list(actor: ListingActor, q?: string): Promise<AdminListingSummary[]> {
    const query = visibleListings(this.listings, actor)
      .innerJoinAndSelect("l.category", "category")
      .leftJoinAndSelect("l.sellers", "listingSeller")
      .leftJoinAndSelect("listingSeller.seller", "seller")
      .leftJoinAndSelect("l.buyer", "buyer")
      .orderBy("l.updated_at", "DESC");
    if (q) {
      query.andWhere(
        `unaccent(lower(l.title)) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'`,
        { q: escapeLike(q) },
      );
    }
    const rows = await query.getMany();
    if (rows.length === 0) return [];
    const stats = await this.dataSource
      .getRepository(ListingImage)
      .createQueryBuilder("i")
      .select("i.listing_id", "listingId")
      .addSelect("COUNT(*)::int", "count")
      .addSelect(
        "(array_agg(i.storage_key ORDER BY i.position))[1]",
        "coverKey",
      )
      .where("i.listing_id IN (:...ids)", { ids: rows.map((row) => row.id) })
      .groupBy("i.listing_id")
      .getRawMany<{ listingId: string; count: number; coverKey: string }>();
    const byListing = new Map(stats.map((row) => [row.listingId, row]));
    return rows.map((row) => {
      const stat = byListing.get(row.id);
      return toSummary(row, stat?.coverKey ?? null, stat?.count ?? 0);
    });
  }

  /** Counts for the admin dashboard; availability covers published listings only. */
  async dashboard(actor: ListingActor): Promise<DashboardCounts> {
    const row = await visibleListings(this.listings, actor)
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
      .getRawOne<DashboardCounts>();
    if (!row) throw new Error("Dashboard aggregate returned no row");
    return row;
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
    // Show contact exactly as it will look once the draft is published.
    return toPublicDetail({ ...listing, publication: "published" }, []);
  }

  async create(
    actor: ListingActor,
    input: Required<Pick<ListingInput, "title" | "categoryId" | "condition">> &
      ListingInput,
  ): Promise<AdminListingDetail> {
    const { storeId } = actor;
    const sellerIds = sellersForNewListing(actor, input.sellerIds);
    if (!sellerIds) {
      throw new AppException(HttpStatus.BAD_REQUEST, NO_SELLER_CHOSEN);
    }
    return this.dataSource.transaction(async (manager) => {
      await assertReferencesBelongToStore(manager, storeId, {
        ...input,
        sellerIds,
      });
      const saved = await manager.getRepository(Listing).save({
        storeId,
        slug: listingSlug(input.title),
        title: input.title,
        description: input.description ?? "",
        categoryId: input.categoryId,
        priceCents: input.priceCents ?? null,
        condition: input.condition,
        attributes: input.attributes ?? [],
        availability: "available",
        publication: "draft",
        publishedAt: null,
      });
      await setSellers(manager, saved.id, sellerIds);
      return toDetail(await this.findWithRelations(manager, storeId, saved.id));
    });
  }

  async update(
    actor: ListingActor,
    id: string,
    patch: ListingInput,
  ): Promise<AdminListingDetail> {
    const { storeId } = actor;
    return this.dataSource.transaction(async (manager) => {
      // Same row lock photo removal takes, so a concurrent delete of the last
      // photo cannot slip in between the photo check and the publish.
      await lockListing(manager, storeId, id);
      const listing = await this.findWithRelations(manager, storeId, id);
      const current = listing.sellers.map((row) => row.sellerId);
      if (!canSetSellers(actor, current, patch.sellerIds)) throw forbidden();
      await assertReferencesBelongToStore(manager, storeId, patch);

      const published = publishPatch(listing, patch.publication);

      const {
        images: _images,
        category: _category,
        sellers: _sellers,
        buyer: _buyer,
        ...row
      } = listing;
      const { sellerIds, ...fields } = patch;
      await manager.getRepository(Listing).save({
        ...row,
        ...definedOnly(fields),
        ...published,
        ...(saleAfterFullUpdate(listing.availability, patch.availability) ===
        "release"
          ? CLEARED_SALE
          : {}),
      });
      if (sellerIds) await setSellers(manager, id, sellerIds);
      return toDetail(await this.findWithRelations(manager, storeId, id));
    });
  }

  /**
   * Change availability and publication, recording or clearing the sale in
   * the same transaction. The listing is locked before the buyer is resolved.
   */
  async changeStatus(
    actor: ListingActor,
    id: string,
    request: ListingStatusRequest,
  ): Promise<AdminListingDetail> {
    const { storeId } = actor;
    return withSaleConflicts(() =>
      this.dataSource.transaction(async (manager) => {
        await lockListing(manager, storeId, id);
        const listing = await this.findWithRelations(manager, storeId, id);
        const transition = saleTransition(listing.availability, {
          availability: request.availability,
          agreedPriceCents: request.agreedPriceCents,
          paid: request.paid,
          notes: request.notes,
          hasBuyer: request.buyer !== undefined,
        });
        if (transition.outcome === "fields-need-buyer") {
          throw new AppException(
            HttpStatus.BAD_REQUEST,
            SALE_FIELDS_NEED_BUYER,
          );
        }
        if (transition.outcome === "available-has-no-buyer") {
          throw new AppException(
            HttpStatus.BAD_REQUEST,
            AVAILABLE_HAS_NO_BUYER,
          );
        }
        if (transition.outcome === "stale") {
          throw new AppException(HttpStatus.CONFLICT, SALE_CHANGED);
        }

        const patch: QueryDeepPartialEntity<Listing> = {
          ...publishPatch(listing, request.publication),
          ...(request.availability && { availability: request.availability }),
          ...(await statusSalePatch(manager, storeId, transition, request)),
        };
        if (Object.keys(patch).length > 0) {
          await manager.getRepository(Listing).update({ id, storeId }, patch);
        }
        return toDetail(await this.findWithRelations(manager, storeId, id));
      }),
    );
  }

  /** Edit the sale of a reserved or sold listing without changing its availability. */
  async editSale(
    actor: ListingActor,
    id: string,
    request: ListingSaleRequest,
  ): Promise<AdminListingDetail> {
    const { storeId } = actor;
    return withSaleConflicts(() =>
      this.dataSource.transaction(async (manager) => {
        const listing = await lockListing(manager, storeId, id);
        const outcome = canEditSale(
          listing.availability,
          listing.buyerId !== null,
          request.buyer !== undefined,
        );
        if (outcome === "stale") {
          throw new AppException(HttpStatus.CONFLICT, SALE_CHANGED);
        }
        if (outcome === "refuse") {
          throw new AppException(HttpStatus.BAD_REQUEST, EDIT_NEEDS_BUYER);
        }

        const patch: QueryDeepPartialEntity<Listing> = definedOnly({
          agreedPriceCents: request.agreedPriceCents,
          paid: request.paid,
          saleNotes: request.notes,
        });
        if (request.buyer) {
          patch.buyerId = (
            await resolveBuyer(manager, storeId, request.buyer)
          ).id;
        }
        await manager.getRepository(Listing).update({ id, storeId }, patch);
        return toDetail(await this.findWithRelations(manager, storeId, id));
      }),
    );
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
        priceCents: source.priceCents,
        condition: source.condition,
        attributes: source.attributes,
        availability: "available",
        publication: "draft",
        publishedAt: null,
      });
      await setSellers(
        manager,
        copy.id,
        source.sellers.map((row) => row.sellerId),
      );
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
      relations: {
        category: true,
        sellers: { seller: true },
        images: true,
        buyer: true,
      },
      order: { images: { position: "ASC" } },
    });
    if (!listing) throw listingNotFound();
    return listing;
  }
}

/** The columns a publication change touches; a published listing needs a photo. */
function publishPatch(
  listing: Pick<Listing, "images" | "publishedAt">,
  publication: Publication | undefined,
): Partial<Pick<Listing, "publication" | "publishedAt">> {
  if (publication === undefined) return {};
  if (publication !== "published") return { publication };
  if (!canPublish(listing.images.length)) {
    throw new AppException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      PUBLISH_REQUIRES_PHOTO,
    );
  }
  return { publication, publishedAt: listing.publishedAt ?? new Date() };
}

/** The sale columns a status request writes: cleared on release, set on entering with a buyer. */
async function statusSalePatch(
  manager: EntityManager,
  storeId: string,
  transition: SaleTransition,
  request: ListingStatusRequest,
): Promise<QueryDeepPartialEntity<Listing>> {
  if (transition.outcome === "release") return CLEARED_SALE;
  if (transition.outcome !== "enter" || !transition.sale || !request.buyer) {
    return {};
  }
  const buyer = await resolveBuyer(manager, storeId, request.buyer);
  return {
    buyerId: buyer.id,
    agreedPriceCents: transition.sale.agreedPriceCents,
    paid: transition.sale.paid,
    saleNotes: transition.sale.notes,
  };
}

const CLEARED_SALE = {
  buyerId: null,
  agreedPriceCents: null,
  paid: false,
  saleNotes: null,
};

/** A buyer removed mid-write breaks the foreign key. */
function withSaleConflicts<T>(run: () => Promise<T>): Promise<T> {
  return withConflicts(run, { "23503": BUYER_NOT_IN_STORE });
}

export async function lockListing(
  manager: EntityManager,
  storeId: string,
  id: string,
): Promise<Listing> {
  const listing = await manager.getRepository(Listing).findOne({
    where: { id, storeId },
    lock: { mode: "pessimistic_write" },
  });
  if (!listing) throw listingNotFound();
  return listing;
}

/**
 * Replace who sells a listing; callers validate the ids first. A profile
 * deleted in the meantime (its member was removed) fails the foreign key.
 */
async function setSellers(
  manager: EntityManager,
  listingId: string,
  sellerIds: string[],
): Promise<void> {
  const rows = manager.getRepository(ListingSeller);
  await rows.delete({ listingId });
  try {
    await rows.insert(sellerIds.map((sellerId) => ({ listingId, sellerId })));
  } catch (err) {
    if (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string }).code === "23503"
    ) {
      throw new AppException(HttpStatus.CONFLICT, INVALID_SELLER);
    }
    throw err;
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
  input: Pick<ListingInput, "sellerIds" | "categoryId">,
): Promise<void> {
  if (
    input.sellerIds !== undefined &&
    (await manager
      .getRepository(Seller)
      .countBy({ id: In(input.sellerIds), storeId })) !== input.sellerIds.length
  ) {
    throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, INVALID_SELLER);
  }
  if (
    input.categoryId !== undefined &&
    !(await manager
      .getRepository(Category)
      .exists({ where: { id: input.categoryId, storeId } }))
  ) {
    throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, INVALID_CATEGORY);
  }
}

function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function toSummary(
  listing: Listing,
  coverKey: string | null,
  imageCount: number,
): AdminListingSummary {
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    priceCents: listing.priceCents,
    condition: listing.condition,
    availability: listing.availability,
    publication: listing.publication,
    category: { id: listing.category.id, name: listing.category.name },
    sellers: listingSellers(listing).map((seller) => ({
      id: seller.id,
      displayName: seller.displayName,
    })),
    coverUrl: coverKey ? mediaUrls(coverKey).sm : null,
    imageCount,
    sale: toAdminSale(listing),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

function toDetail(listing: Listing): AdminListingDetail {
  return {
    ...toSummary(
      listing,
      listing.images[0]?.storageKey ?? null,
      listing.images.length,
    ),
    description: listing.description,
    attributes: listing.attributes,
    images: listing.images.map(toAdminImage),
  };
}
