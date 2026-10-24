import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { StoresModule } from "@/stores/stores.module";
import { InviteAcceptController } from "./controllers/invite-accept.controller";
import { InvitesController } from "./controllers/invites.controller";
import { InvitesService } from "./services/invites.service";

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [InvitesController, InviteAcceptController],
  providers: [InvitesService],
})
export class InvitesModule {}
