import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, type Repository } from "typeorm";
import { Listing } from "@/catalog/entities/listing.entity";
import { MediaService } from "@/media/media.service";
import { mediaUrls } from "@/media/media-urls";
import { Seller } from "../entities/seller.entity";

export interface SellerResponse {
  id: string;
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
    @InjectRepository(Listing)
    private readonly listings: Repository<Listing>,
    private readonly media: MediaService,
  ) {}

  async list(storeId: string): Promise<SellerResponse[]> {
    const rows = await this.sellers.find({
      where: { storeId },
      order: { createdAt: "ASC" },
    });
    const counts = await this.listings
      .createQueryBuilder("l")
      .select("l.seller_id", "sellerId")
      .addSelect("COUNT(*)::int", "count")
      .where("l.store_id = :storeId", { storeId })
      .groupBy("l.seller_id")
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

  async remove(storeId: string, id: string): Promise<void> {
    const seller = await this.findOrFail(storeId, id);
    if (await this.listings.exists({ where: { sellerId: seller.id } })) {
      throw new ConflictException(SELLER_HAS_LISTINGS);
    }
    try {
      await this.sellers.delete({ id: seller.id, storeId });
    } catch (err) {
      // A listing created after the check above still trips the FK.
      if (isForeignKeyViolation(err)) {
        throw new ConflictException(SELLER_HAS_LISTINGS);
      }
      throw err;
    }
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
      await this.listings.count({ where: { sellerId: seller.id } }),
    );
  }
}

const SELLER_HAS_LISTINGS =
  "Este vendedor ainda tem anúncios. Transfira ou exclua os anúncios antes.";
const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string })?.code === FOREIGN_KEY_VIOLATION
  );
}

function toResponse(seller: Seller, listingCount: number): SellerResponse {
  return {
    id: seller.id,
    displayName: seller.displayName,
    whatsappNumber: seller.whatsappNumber,
    avatarUrl: seller.avatarKey ? mediaUrls(seller.avatarKey).sm : null,
    listingCount,
  };
}
