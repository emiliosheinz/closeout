import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { Listing } from "@/catalog/entities/listing.entity";
import { StoresModule } from "@/stores/stores.module";
import { BuyersController } from "./controllers/buyers.controller";
import { Buyer } from "./entities/buyer.entity";
import { BuyersService } from "./services/buyers.service";

@Module({
  imports: [
    AuthModule,
    StoresModule,
    TypeOrmModule.forFeature([Buyer, Listing]),
  ],
  controllers: [BuyersController],
  providers: [BuyersService],
})
export class BuyersModule {}
