import type { WaitlistSignupRequest } from "@closeout/contracts/schemas";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { WaitlistSignup } from "../entities/waitlist-signup.entity";

/**
 * Stores waitlist signups. Never logs the name or contact: they are personal
 * data and only the operator CLI exports them.
 */
@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(WaitlistSignup)
    private readonly signups: Repository<WaitlistSignup>,
  ) {}

  /**
   * `request` is already parsed. A filled honeypot or an already stored
   * contact is dropped silently, so the caller cannot tell it from a new one.
   */
  async signup(request: WaitlistSignupRequest): Promise<void> {
    const { name, channel, contact, ref, src, website } = request;
    if (website?.trim()) {
      this.logger.warn({ ref, src }, "Waitlist honeypot filled");
      return;
    }
    const result = await this.signups
      .createQueryBuilder()
      .insert()
      .values({ name, channel, contact, ref: ref ?? null, src: src ?? null })
      .orIgnore()
      .returning("id")
      .execute();
    const [created] = result.raw as { id: string }[];
    if (!created) return;
    this.logger.log(
      { signupId: created.id, channel, ref, src },
      "Waitlist signup stored",
    );
  }

  /** Every signup, newest first. */
  list(): Promise<WaitlistSignup[]> {
    return this.signups.find({ order: { createdAt: "DESC" } });
  }

  /** Delete the signup with this normalized contact; whether one existed. */
  async remove(contact: string): Promise<boolean> {
    const result = await this.signups.delete({ contact });
    return (result.affected ?? 0) > 0;
  }
}
