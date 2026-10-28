import type { SellerRequest } from "@closeout/contracts/schemas";
import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { ListingSeller } from "@/catalog/entities/listing-seller.entity";
import { MediaService } from "@/media/media.service";
import { mediaUrls } from "@/media/media-urls";
import { AppException } from "@/problem/app-exception";
import {
  forbidden,
  isManager,
  type MembershipContext,
} from "@/stores/membership";
import { Seller } from "../entities/seller.entity";

const SELLER_NOT_FOUND = "Vendedor não encontrado.";

export interface SellerResponse {
  id: string;
  /** The member this profile represents. */
  userId: string;
  displayName: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  listingCount: number;
}

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(Seller)
    private readonly sellers: Repository<Seller>,
    @InjectRepository(ListingSeller)
    private readonly listingSellers: Repository<ListingSeller>,
    private readonly media: MediaService,
  ) {}

  async list(storeId: string): Promise<SellerResponse[]> {
    const rows = await this.sellers.find({
      where: { storeId },
      order: { createdAt: "ASC" },
    });
    const counts = await this.listingSellers
      .createQueryBuilder("ls")
      .innerJoin("ls.seller", "s")
      .select("ls.seller_id", "sellerId")
      .addSelect("COUNT(*)::int", "count")
      .where("s.store_id = :storeId", { storeId })
      .groupBy("ls.seller_id")
      .getRawMany<{ sellerId: string; count: number }>();
    const countBySeller = new Map(counts.map((c) => [c.sellerId, c.count]));
    return rows.map((row) => toResponse(row, countBySeller.get(row.id) ?? 0));
  }

  async update(
    actor: MembershipContext,
    id: string,
    patch: SellerRequest,
  ): Promise<SellerResponse> {
    const seller = await this.findEditable(actor, id);
    if (patch.displayName !== undefined) seller.displayName = patch.displayName;
    if (patch.whatsappNumber !== undefined) {
      seller.whatsappNumber = patch.whatsappNumber;
    }
    return this.toResponse(await this.sellers.save(seller));
  }

  async setAvatar(
    actor: MembershipContext,
    id: string,
    file: Buffer,
  ): Promise<SellerResponse> {
    const seller = await this.findEditable(actor, id);
    const stored = await this.media.store(file);
    const previous = seller.avatarKey;
    seller.avatarKey = stored.key;
    try {
      await this.sellers.save(seller);
    } catch (err) {
      await this.media.remove(stored.key);
      throw err;
    }
    if (previous) await this.media.remove(previous);
    return this.toResponse(seller);
  }

  /** Managers edit every profile in the store; sellers only their own. */
  private async findEditable(
    actor: MembershipContext,
    id: string,
  ): Promise<Seller> {
    if (!isManager(actor.role) && id !== actor.sellerId) throw forbidden();
    const seller = await this.sellers.findOne({
      where: { id, storeId: actor.storeId },
    });
    if (!seller) {
      throw new AppException(HttpStatus.NOT_FOUND, SELLER_NOT_FOUND);
    }
    return seller;
  }

  private async toResponse(seller: Seller): Promise<SellerResponse> {
    return toResponse(
      seller,
      await this.listingSellers.count({ where: { sellerId: seller.id } }),
    );
  }
}

function toResponse(seller: Seller, listingCount: number): SellerResponse {
  return {
    id: seller.id,
    userId: seller.userId,
    displayName: seller.displayName,
    whatsappNumber: seller.whatsappNumber,
    avatarUrl: seller.avatarKey ? mediaUrls(seller.avatarKey).sm : null,
    listingCount,
  };
}
