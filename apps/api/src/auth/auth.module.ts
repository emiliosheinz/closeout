import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthController } from "./auth.controller";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";
import { SessionGuard } from "./guards/session.guard";
import { AuthService } from "./services/auth.service";
import { LoginRateLimiter } from "./services/login-rate-limiter";
import { SessionsService } from "./services/sessions.service";

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, LoginRateLimiter, SessionGuard],
  exports: [SessionsService, SessionGuard],
})
export class AuthModule {}
