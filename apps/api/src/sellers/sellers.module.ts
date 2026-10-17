import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { Listing } from "@/catalog/entities/listing.entity";
import { MediaModule } from "@/media/media.module";
import { StoresModule } from "@/stores/stores.module";
import { SellersController } from "./controllers/sellers.controller";
import { Seller } from "./entities/seller.entity";
import { SellersService } from "./services/sellers.service";

@Module({
  imports: [
    AuthModule,
    StoresModule,
    MediaModule,
    TypeOrmModule.forFeature([Seller, Listing]),
  ],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
