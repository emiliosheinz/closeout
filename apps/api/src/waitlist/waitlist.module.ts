import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WaitlistController } from "./controllers/waitlist.controller";
import { WaitlistSignup } from "./entities/waitlist-signup.entity";
import { WaitlistSignupRateLimitGuard } from "./guards/waitlist-signup-rate-limit.guard";
import { WaitlistService } from "./services/waitlist.service";

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistSignup])],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistSignupRateLimitGuard],
})
export class WaitlistModule {}
