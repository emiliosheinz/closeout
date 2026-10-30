import {
  type CatalogQuery,
  NOT_FOUND,
  type PublicListingDetail,
  type PublicListingSummary,
} from "@closeout/contracts/schemas";
import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  In,
  IsNull,
  Not,
  type Repository,
  type SelectQueryBuilder,
} from "typeorm";
import { mediaUrls } from "@/media/media-urls";
import { AppException } from "@/problem/app-exception";
import { Seller } from "@/sellers/entities/seller.entity";
import { Category } from "@/stores/entities/category.entity";
import { Store } from "@/stores/entities/store.entity";
import { Listing } from "../entities/listing.entity";
import { ListingImage } from "../entities/listing-image.entity";
import { toPublicDetail, toPublicSummary } from "../public-mappers";
import { escapeLike } from "../sql";

const RELATED_LIMIT = 4;
const DEFAULT_PAGE_SIZE = 24;

/** Exactly what toPublicSummary reads, plus the id used to attach covers. */
const SUMMARY_COLUMNS = [
  "l.id",
  "l.slug",
  "l.title",
  "l.priceCents",
  "l.condition",
  "l.availability",
  "category.id",
  "category.slug",
  "category.name",
];

export interface PublicStore {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  locale: string;
  currency: string;
  counts: { available: number; reserved: number; sold: number };
  categories: { slug: string; name: string; count: number }[];
  sellers: {
    name: string;
    avatarUrl: string | null;
    whatsappNumber: string;
  }[];
}

export interface PublicStoreIndex {
  items: { slug: string }[];
}

export interface PublicListingPage {
  items: PublicListingSummary[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class PublicCatalogService {
  constructor(
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ListingImage)
    private readonly images: Repository<ListingImage>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
  ) {}

  async getStore(slug: string): Promise<PublicStore> {
    const store = await this.findStore(slug);

    const countsQuery = this.listings
      .createQueryBuilder("l")
      .select(
        `COUNT(*) FILTER (WHERE l.availability = 'available')::int`,
        "available",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE l.availability = 'reserved')::int`,
        "reserved",
      )
      .addSelect(`COUNT(*) FILTER (WHERE l.availability = 'sold')::int`, "sold")
      .where("l.store_id = :storeId", { storeId: store.id })
      .andWhere("l.publication = 'published'")
      .getRawOne<PublicStore["counts"]>();

    const categoriesQuery = this.categories
      .createQueryBuilder("c")
      .leftJoin(
        Listing,
        "l",
        `l.category_id = c.id AND l.publication = 'published' AND l.availability <> 'sold'`,
      )
      .select("c.slug", "slug")
      .addSelect("c.name", "name")
      .addSelect("COUNT(l.id)::int", "count")
      .where("c.store_id = :storeId", { storeId: store.id })
      .groupBy("c.id")
      .orderBy("c.position", "ASC")
      .getRawMany<{ slug: string; name: string; count: number }>();

    const sellersQuery = this.sellers.find({
      where: { storeId: store.id, whatsappNumber: Not(IsNull()) },
      order: { createdAt: "ASC" },
    });

    const [counts, categoryRows, sellers] = await Promise.all([
      countsQuery,
      categoriesQuery,
      sellersQuery,
    ]);

    return {
      slug: store.slug,
      name: store.name,
      headline: store.headline,
      intro: store.intro,
      locale: store.locale,
      currency: store.currency,
      counts: counts ?? { available: 0, reserved: 0, sold: 0 },
      categories: categoryRows,
      sellers: sellers.flatMap((seller) =>
        seller.whatsappNumber
          ? [
              {
                name: seller.displayName,
                avatarUrl: seller.avatarKey
                  ? mediaUrls(seller.avatarKey).sm
                  : null,
                whatsappNumber: seller.whatsappNumber,
              },
            ]
          : [],
      ),
    };
  }

  async listListings(
    storeSlug: string,
    query: CatalogQuery,
  ): Promise<PublicListingPage> {
    const store = await this.findStore(storeSlug);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const builder = this.listings
      .createQueryBuilder("l")
      .innerJoin("l.category", "category")
      .select(SUMMARY_COLUMNS)
      .where("l.store_id = :storeId", { storeId: store.id })
      .andWhere("l.publication = 'published'");
    applyFilters(builder, query);
    applySort(builder, query.sort ?? "recent");

    // Category is many-to-one, so offset/limit cannot split a listing and
    // TypeORM skips its distinct-ids pre-query.
    const [rows, total] = await Promise.all([
      builder
        .clone()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .getMany(),
      builder.getCount(),
    ]);

    return {
      items: await this.withCovers(rows),
      total,
      page,
      pageSize,
    };
  }

  async getListing(
    storeSlug: string,
    listingSlug: string,
  ): Promise<PublicListingDetail> {
    const store = await this.findStore(storeSlug);
    const listing = await this.listings.findOne({
      where: { storeId: store.id, slug: listingSlug, publication: "published" },
      relations: { category: true, sellers: { seller: true }, images: true },
      order: { images: { position: "ASC" } },
    });
    if (!listing) throw new AppException(HttpStatus.NOT_FOUND, NOT_FOUND);
    return toPublicDetail(listing, await this.related(listing));
  }

  /** Other listed items, same category first, newest first. */
  private async related(listing: Listing): Promise<PublicListingSummary[]> {
    const rows = await this.listings
      .createQueryBuilder("l")
      .innerJoin("l.category", "category")
      .select(SUMMARY_COLUMNS)
      .where("l.store_id = :storeId", { storeId: listing.storeId })
      .andWhere("l.publication = 'published'")
      .andWhere("l.availability <> 'sold'")
      .andWhere("l.id <> :id", { id: listing.id })
      .orderBy("CASE WHEN l.category_id = :categoryId THEN 0 ELSE 1 END", "ASC")
      .addOrderBy("l.published_at", "DESC")
      .setParameter("categoryId", listing.categoryId)
      .limit(RELATED_LIMIT)
      .getMany();
    return this.withCovers(rows);
  }

  async listStores(): Promise<PublicStoreIndex> {
    const rows = await this.stores.find({
      select: { slug: true },
      order: { slug: "ASC" },
    });
    return { items: rows.map(({ slug }) => ({ slug })) };
  }

  private async withCovers(rows: Listing[]): Promise<PublicListingSummary[]> {
    if (rows.length === 0) return [];
    const covers = await this.images.find({
      where: { listingId: In(rows.map((row) => row.id)), position: 0 },
    });
    const coverByListing = new Map(covers.map((c) => [c.listingId, c]));
    return rows.map((row) => toPublicSummary(row, coverByListing.get(row.id)));
  }

  private async findStore(slug: string): Promise<Store> {
    const store = await this.stores.findOne({ where: { slug } });
    if (!store) throw new AppException(HttpStatus.NOT_FOUND, NOT_FOUND);
    return store;
  }
}

function applyFilters(
  builder: SelectQueryBuilder<Listing>,
  query: CatalogQuery,
): void {
  const availability = query.availability ?? "listed";
  if (availability === "listed") {
    builder.andWhere("l.availability <> 'sold'");
  } else if (availability !== "all") {
    builder.andWhere("l.availability = :availability", { availability });
  }

  if (query.q) {
    // ponytail: sequential scan with unaccent + LIKE is fine for hundreds of
    // listings; add a pg_trgm GIN index on this expression past ~10k rows.
    builder.andWhere(
      `unaccent(lower(l.title || ' ' || l.description)) LIKE '%' || unaccent(lower(:q)) || '%' ESCAPE '\\'`,
      { q: escapeLike(query.q) },
    );
  }
  if (query.category) {
    builder.andWhere("category.slug = :category", { category: query.category });
  }
  if (query.condition) {
    builder.andWhere("l.condition = :condition", {
      condition: query.condition,
    });
  }
  if (query.minPrice !== undefined) {
    builder.andWhere("l.price_cents >= :minPrice", {
      minPrice: query.minPrice,
    });
  }
  if (query.maxPrice !== undefined) {
    builder.andWhere("l.price_cents <= :maxPrice", {
      maxPrice: query.maxPrice,
    });
  }
}

function applySort(
  builder: SelectQueryBuilder<Listing>,
  sort: NonNullable<CatalogQuery["sort"]>,
): void {
  if (sort === "price_asc") {
    builder.orderBy("l.priceCents", "ASC", "NULLS LAST");
  } else if (sort === "price_desc") {
    builder.orderBy("l.priceCents", "DESC", "NULLS LAST");
  }
  builder
    .addOrderBy("l.publishedAt", "DESC", "NULLS LAST")
    .addOrderBy("l.id", "ASC");
}
