import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { MediaService } from "@/media/media.service";
import { mediaUrls } from "@/media/media-urls";
import type {
  AssignableRole,
  StoreRole,
} from "../entities/store-member.entity";
import { forbidden, type MembershipContext } from "../membership";

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: StoreRole;
  /** The member's contact profile. */
  sellerId: string;
  displayName: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  listingCount: number;
}

interface MemberRow extends Omit<TeamMember, "avatarUrl"> {
  avatarKey: string | null;
}

const MEMBER_NOT_FOUND = "Membro não encontrado.";

/**
 * Membership changes a manager applies to other members. Targets are looked
 * up through the actor's store, so a user of another store answers exactly
 * like an unknown id.
 */
@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly media: MediaService,
  ) {}

  async list(storeId: string): Promise<TeamMember[]> {
    const rows = await this.members(storeId);
    return rows.map(toTeamMember);
  }

  async changeRole(
    actor: MembershipContext,
    userId: string,
    role: AssignableRole,
  ): Promise<TeamMember> {
    const target = await this.findTarget(actor, userId);
    await this.dataSource.query(
      `UPDATE store_members SET role = $3
        WHERE store_id = $1 AND user_id = $2 AND role <> 'owner'`,
      [actor.storeId, userId, role],
    );
    this.logger.log(
      `Member ${userId} (${target.email}) of store ${actor.storeId} changed from ${target.role} to ${role} by ${actor.userId}`,
    );
    return toTeamMember({ ...target, role });
  }

  /**
   * Deletes the member's account, which takes their membership, contact
   * profile, listing assignments and sessions with it. Refused while they
   * are the only seller of any listing, which would be left with nobody.
   */
  async remove(actor: MembershipContext, userId: string): Promise<void> {
    const target = await this.findTarget(actor, userId);
    await this.dataSource.transaction(async (manager) => {
      // Waits for any in-flight write that is adding this profile to a
      // listing (it holds a key-share lock on the row through the foreign
      // key), so the count below sees it.
      await manager.query(`SELECT 1 FROM sellers WHERE id = $1 FOR UPDATE`, [
        target.sellerId,
      ]);
      const [sole] = await manager.query<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM listing_sellers mine
          WHERE mine.seller_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM listing_sellers other
               WHERE other.listing_id = mine.listing_id
                 AND other.seller_id <> mine.seller_id)`,
        [target.sellerId],
      );
      const count = sole?.count ?? 0;
      if (count > 0) throw new ConflictException(soleSellerMessage(count));
      await manager.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });
    this.logger.log(
      `Member ${userId} (${target.email}) removed from store ${actor.storeId} by ${actor.userId}`,
    );
    if (target.avatarKey) await this.media.remove(target.avatarKey);
  }

  /** Another non-owner member of the actor's store. */
  private async findTarget(
    actor: MembershipContext,
    userId: string,
  ): Promise<MemberRow> {
    const [target] = await this.members(actor.storeId, userId);
    if (!target) throw new NotFoundException(MEMBER_NOT_FOUND);
    if (target.role === "owner" || target.userId === actor.userId) {
      throw forbidden();
    }
    return target;
  }

  private members(storeId: string, userId?: string): Promise<MemberRow[]> {
    return this.dataSource.query(
      `SELECT u.id AS "userId", u.name, u.email, m.role,
              s.id AS "sellerId", s.display_name AS "displayName",
              s.whatsapp_number AS "whatsappNumber", s.avatar_key AS "avatarKey",
              (SELECT COUNT(*)::int FROM listing_sellers ls
                WHERE ls.seller_id = s.id) AS "listingCount"
         FROM store_members m
         JOIN users u ON u.id = m.user_id
         JOIN sellers s ON s.store_id = m.store_id AND s.user_id = m.user_id
        WHERE m.store_id = $1 AND ($2::uuid IS NULL OR m.user_id = $2)
        ORDER BY m.created_at, u.id`,
      [storeId, userId ?? null],
    );
  }
}

function soleSellerMessage(count: number): string {
  const listings = count === 1 ? "o 1 anúncio" : `os ${count} anúncios`;
  return `Reatribua ${listings} em que esta pessoa é a única vendedora antes de removê-la.`;
}

function toTeamMember({ avatarKey, ...row }: MemberRow): TeamMember {
  return { ...row, avatarUrl: avatarKey ? mediaUrls(avatarKey).sm : null };
}
