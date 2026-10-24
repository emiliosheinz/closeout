import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { User } from "@/auth/entities/user.entity";
import { Seller } from "@/sellers/entities/seller.entity";
import { MeController } from "./controllers/me.controller";
import { StoreAdminController } from "./controllers/store-admin.controller";
import { Category } from "./entities/category.entity";
import { Store } from "./entities/store.entity";
import { StoreMember } from "./entities/store-member.entity";
import { StoreMemberGuard } from "./guards/store-member.guard";
import { StoresService } from "./services/stores.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Store, StoreMember, Category, User, Seller]),
  ],
  controllers: [MeController, StoreAdminController],
  providers: [StoresService, StoreMemberGuard],
  exports: [StoresService, StoreMemberGuard, TypeOrmModule],
})
export class StoresModule {}
