import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogQueryDto } from "../dto/catalog-query.dto";
import type { PublicListingDetail } from "../public-mappers";
import {
  PublicCatalogService,
  type PublicListingPage,
  type PublicStore,
} from "../services/public-catalog.service";

/** Unauthenticated, read-only endpoints backing the storefront. */
@Controller("public/stores/:storeSlug")
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get()
  store(@Param("storeSlug") storeSlug: string): Promise<PublicStore> {
    return this.catalog.getStore(storeSlug);
  }

  @Get("listings")
  listings(
    @Param("storeSlug") storeSlug: string,
    @Query() query: CatalogQueryDto,
  ): Promise<PublicListingPage> {
    return this.catalog.listListings(storeSlug, query);
  }

  @Get("listings/:listingSlug")
  listing(
    @Param("storeSlug") storeSlug: string,
    @Param("listingSlug") listingSlug: string,
  ): Promise<PublicListingDetail> {
    return this.catalog.getListing(storeSlug, listingSlug);
  }
}
