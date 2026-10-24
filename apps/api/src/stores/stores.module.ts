import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "@/auth/auth.module";
import { User } from "@/auth/entities/user.entity";
import { MediaModule } from "@/media/media.module";
import { Seller } from "@/sellers/entities/seller.entity";
import { MeController } from "./controllers/me.controller";
import { StoreAdminController } from "./controllers/store-admin.controller";
import { TeamController } from "./controllers/team.controller";
import { Category } from "./entities/category.entity";
import { Store } from "./entities/store.entity";
import { StoreMember } from "./entities/store-member.entity";
import { StoreMemberGuard } from "./guards/store-member.guard";
import { StoresService } from "./services/stores.service";
import { TeamService } from "./services/team.service";

@Module({
  imports: [
    AuthModule,
    MediaModule,
    TypeOrmModule.forFeature([Store, StoreMember, Category, User, Seller]),
  ],
  controllers: [MeController, StoreAdminController, TeamController],
  providers: [StoresService, TeamService, StoreMemberGuard],
  exports: [StoresService, StoreMemberGuard, TypeOrmModule],
})
export class StoresModule {}
