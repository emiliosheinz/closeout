import type { BuyerSummary } from "@closeout/contracts/schemas";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { Listing } from "@/catalog/entities/listing.entity";
import { visibleToActor } from "@/catalog/listing-queries";
import type { MembershipContext } from "@/stores/membership";
import { Buyer } from "../entities/buyer.entity";

interface AggregateRow {
  id: string;
  name: string;
  whatsappNumber: string | null;
  listingId: string | null;
  title: string;
  availability: BuyerSummary["items"][number]["availability"];
  agreedPriceCents: number | null;
  paid: boolean;
}

@Injectable()
export class BuyersService {
  constructor(
    @InjectRepository(Buyer) private readonly buyers: Repository<Buyer>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
  ) {}

  /**
   * Every store buyer. Items, owed and unpriced count cover only the
   * listings the actor can see; the linked count is store-wide.
   */
  async list(actor: MembershipContext): Promise<BuyerSummary[]> {
    const { sql, params } = visibleToActor(actor);
    const [rows, counts] = await Promise.all([
      this.buyers
        .createQueryBuilder("b")
        .leftJoin(Listing, "l", `l.buyer_id = b.id AND ${sql}`, params)
        .select("b.id", "id")
        .addSelect("b.name", "name")
        .addSelect("b.whatsapp_number", "whatsappNumber")
        .addSelect("l.id", "listingId")
        .addSelect("l.title", "title")
        .addSelect("l.availability", "availability")
        .addSelect("l.agreed_price_cents", "agreedPriceCents")
        .addSelect("l.paid", "paid")
        .where("b.store_id = :storeId", { storeId: actor.storeId })
        .orderBy("b.name_key", "ASC")
        .addOrderBy("b.id", "ASC")
        .addOrderBy("l.title", "ASC")
        .addOrderBy("l.id", "ASC")
        .getRawMany<AggregateRow>(),
      this.listings
        .createQueryBuilder("l")
        .select("l.buyer_id", "buyerId")
        .addSelect("COUNT(*)::int", "count")
        .where("l.store_id = :storeId AND l.buyer_id IS NOT NULL", {
          storeId: actor.storeId,
        })
        .groupBy("l.buyer_id")
        .getRawMany<{ buyerId: string; count: number }>(),
    ]);
    const linked = new Map(counts.map((c) => [c.buyerId, c.count]));

    const summaries = new Map<string, BuyerSummary>();
    for (const row of rows) {
      let summary = summaries.get(row.id);
      if (!summary) {
        summary = {
          id: row.id,
          name: row.name,
          whatsappNumber: row.whatsappNumber,
          linkedCount: linked.get(row.id) ?? 0,
          items: [],
          owedCents: 0,
          unpricedCount: 0,
        };
        summaries.set(row.id, summary);
      }
      if (row.listingId === null) continue;
      summary.items.push({
        listingId: row.listingId,
        title: row.title,
        availability: row.availability,
        agreedPriceCents: row.agreedPriceCents,
        paid: row.paid,
      });
      if (row.paid) continue;
      if (row.agreedPriceCents === null) summary.unpricedCount += 1;
      else summary.owedCents += row.agreedPriceCents;
    }
    return [...summaries.values()];
  }
}
