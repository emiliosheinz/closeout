import {
  type CatalogQuery,
  catalogQuerySchema,
  routeNameSchema,
} from "@closeout/contracts/schemas";
import { Controller, Get, Param, Query } from "@nestjs/common";
import type { PublicListingDetail } from "../public-mappers";
import {
  PublicCatalogService,
  type PublicListingPage,
  type PublicStore,
  type PublicStoreIndex,
} from "../services/public-catalog.service";

/** Unauthenticated, read-only endpoints backing the storefront. */
@Controller("public/stores")
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  /** Every store's slug, for the sitemap. */
  @Get()
  stores(): Promise<PublicStoreIndex> {
    return this.catalog.listStores();
  }

  @Get(":storeSlug")
  store(
    @Param("storeSlug", { schema: routeNameSchema }) storeSlug: string,
  ): Promise<PublicStore> {
    return this.catalog.getStore(storeSlug);
  }

  @Get(":storeSlug/listings")
  listings(
    @Param("storeSlug", { schema: routeNameSchema }) storeSlug: string,
    @Query({ schema: catalogQuerySchema }) query: CatalogQuery,
  ): Promise<PublicListingPage> {
    return this.catalog.listListings(storeSlug, query);
  }

  @Get(":storeSlug/listings/:listingSlug")
  listing(
    @Param("storeSlug", { schema: routeNameSchema }) storeSlug: string,
    @Param("listingSlug", { schema: routeNameSchema }) listingSlug: string,
  ): Promise<PublicListingDetail> {
    return this.catalog.getListing(storeSlug, listingSlug);
  }
}
