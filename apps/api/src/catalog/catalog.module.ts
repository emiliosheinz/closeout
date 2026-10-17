import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { MediaModule } from "@/media/media.module";
import { Seller } from "@/sellers/entities/seller.entity";
import { Category } from "@/stores/entities/category.entity";
import { Store } from "@/stores/entities/store.entity";
import { StoresModule } from "@/stores/stores.module";
import { ListingsController } from "./controllers/listings.controller";
import { PublicCatalogController } from "./controllers/public-catalog.controller";
import { Listing } from "./entities/listing.entity";
import { ListingImage } from "./entities/listing-image.entity";
import { ListingImagesService } from "./services/listing-images.service";
import { ListingsService } from "./services/listings.service";
import { PublicCatalogService } from "./services/public-catalog.service";

@Module({
  imports: [
    AuthModule,
    StoresModule,
    MediaModule,
    TypeOrmModule.forFeature([Listing, ListingImage, Store, Category, Seller]),
  ],
  controllers: [ListingsController, PublicCatalogController],
  providers: [ListingsService, ListingImagesService, PublicCatalogService],
  exports: [ListingsService, ListingImagesService],
})
export class CatalogModule {}
