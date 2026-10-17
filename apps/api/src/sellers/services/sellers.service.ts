import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DataSource, Repository } from "typeorm";
import { ListingSeller } from "@/catalog/entities/listing-seller.entity";
import { MediaService } from "@/media/media.service";
import { mediaUrls } from "@/media/media-urls";
import { Seller } from "../entities/seller.entity";

export interface SellerResponse {
  id: string;
  /** The administrator this profile represents, if any. */
  userId: string | null;
  displayName: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  listingCount: number;
}

export interface SellerInput {
  displayName?: string;
  whatsappNumber?: string | null;
}

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(Seller)
    private readonly sellers: Repository<Seller>,
    @InjectRepository(ListingSeller)
    private readonly listingSellers: Repository<ListingSeller>,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  async create(
    storeId: string,
    input: { displayName: string; whatsappNumber?: string | null },
  ): Promise<SellerResponse> {
    const saved = await this.sellers.save(
      this.sellers.create({
        storeId,
        displayName: input.displayName,
        whatsappNumber: input.whatsappNumber ?? null,
      }),
    );
    return this.toResponse(saved);
  }

  async update(
    storeId: string,
    id: string,
    patch: SellerInput,
  ): Promise<SellerResponse> {
    const seller = await this.findOrFail(storeId, id);
    if (patch.displayName !== undefined) seller.displayName = patch.displayName;
    if (patch.whatsappNumber !== undefined) {
      seller.whatsappNumber = patch.whatsappNumber;
    }
    return this.toResponse(await this.sellers.save(seller));
  }

  /**
   * Removes the seller from the listings they share with someone else.
   * Refused while they are the only seller of a listing, which would be left
   * with nobody to contact.
   */
  async remove(storeId: string, id: string): Promise<void> {
    const seller = await this.findOrFail(storeId, id);
    await this.dataSource.transaction(async (manager) => {
      // Waits for any in-flight write that is adding this seller to a
      // listing (it holds a key-share lock on the row through the foreign
      // key), so the check below sees it.
      await manager.query(
        `SELECT 1 FROM sellers WHERE id = $1 AND store_id = $2 FOR UPDATE`,
        [seller.id, storeId],
      );
      const [soleSeller] = await manager.query(
        `SELECT 1 FROM listing_sellers mine
          WHERE mine.seller_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM listing_sellers other
               WHERE other.listing_id = mine.listing_id
                 AND other.seller_id <> mine.seller_id)
          LIMIT 1`,
        [seller.id],
      );
      if (soleSeller) throw new ConflictException(ONLY_SELLER_OF_LISTINGS);
      await manager.getRepository(Seller).delete({ id: seller.id, storeId });
    });
    if (seller.avatarKey) await this.media.remove(seller.avatarKey);
  }

  async setAvatar(
    storeId: string,
    id: string,
    file: Buffer,
  ): Promise<SellerResponse> {
    const seller = await this.findOrFail(storeId, id);
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

  private async findOrFail(storeId: string, id: string): Promise<Seller> {
    const seller = await this.sellers.findOne({ where: { id, storeId } });
    if (!seller) throw new NotFoundException("Vendedor não encontrado.");
    return seller;
  }

  private async toResponse(seller: Seller): Promise<SellerResponse> {
    return toResponse(
      seller,
      await this.listingSellers.count({ where: { sellerId: seller.id } }),
    );
  }
}

const ONLY_SELLER_OF_LISTINGS =
  "Este vendedor é o único de alguns anúncios. Adicione outra pessoa a eles ou exclua os anúncios antes.";

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
