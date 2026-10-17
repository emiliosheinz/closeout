import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { LoginRateLimiter } from "./login-rate-limiter";
import { getDummyHash, verifyPassword } from "./passwords";
import { SessionsService } from "./sessions.service";

const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";
const TOO_MANY_ATTEMPTS =
  "Muitas tentativas. Tente novamente em alguns minutos.";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly sessions: SessionsService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  /**
   * Verify credentials and mint a session. Unknown emails still pay for a
   * hash comparison, and every failure returns the same message, so the
   * response does not reveal whether an account exists.
   */
  async login(
    email: string,
    password: string,
    clientIp: string,
  ): Promise<{ sessionToken: string; expiresAt: Date }> {
    if (this.limiter.isBlocked(email, clientIp)) {
      this.logger.warn(`Login rate limited for ${clientIp}`);
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }

    this.limiter.recordFailure(email, clientIp);
    const user = await this.users.findOne({ where: { email } });
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? (await getDummyHash()),
    );
    if (!user || !valid) {
      this.logger.warn(`Failed login from ${clientIp}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    this.limiter.forgiveSuccess(email, clientIp);
    const { rawToken, expiresAt } = await this.sessions.mint(user.id);
    return { sessionToken: rawToken, expiresAt };
  }
}
