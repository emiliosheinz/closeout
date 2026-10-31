import {
  type Buyer as BuyerResponse,
  type BuyerSummary,
  type BuyerUpdateRequest,
  buyerNameKey,
} from "@closeout/contracts/schemas";
import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DataSource, Repository } from "typeorm";
import { Listing } from "@/catalog/entities/listing.entity";
import { visibleToActor } from "@/catalog/listing-queries";
import { AppException } from "@/problem/app-exception";
import { withConflicts } from "@/problem/db-conflicts";
import type { MembershipContext } from "@/stores/membership";
import { Buyer } from "../entities/buyer.entity";
import { BUYER_NOT_IN_STORE, lockBuyerListings } from "../resolve-buyer";

const BUYER_NOT_FOUND = "Comprador não encontrado.";
const NAME_TAKEN = "Já existe um comprador com esse nome. Use Juntar com...";

const HAS_ITEMS =
  "Este comprador tem itens vinculados em anúncios da loja. Junte-o a outro comprador.";
const SAME_BUYER = "Escolha outro comprador para juntar.";

interface AggregateRow {
  id: string;
  name: string;
  whatsappNumber: string | null;
  listingId: string | null;
  title: string | null;
  availability: BuyerSummary["items"][number]["availability"];
  agreedPriceCents: number | null;
  paid: boolean;
}

/** Groups the aggregate rows per buyer; owed and unpriced cover unpaid items only. */
function summarize(
  rows: AggregateRow[],
  linked: Map<string, number>,
): BuyerSummary[] {
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
    if (row.listingId === null || row.title === null) continue;
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

@Injectable()
export class BuyersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
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
    return summarize(rows, new Map(counts.map((c) => [c.buyerId, c.count])));
  }

  async update(
    storeId: string,
    id: string,
    patch: BuyerUpdateRequest,
  ): Promise<BuyerResponse> {
    const changes: Partial<Buyer> = {};
    if (patch.name !== undefined) {
      changes.name = patch.name;
      changes.nameKey = buyerNameKey(patch.name);
    }
    if (patch.whatsappNumber !== undefined) {
      changes.whatsappNumber = patch.whatsappNumber;
    }
    // An update never recreates a buyer deleted or merged in the meantime.
    const { affected } =
      Object.keys(changes).length === 0
        ? { affected: 1 }
        : await withConflicts(
            () => this.buyers.update({ id, storeId }, changes),
            { "23505": NAME_TAKEN },
          );
    const buyer = affected
      ? await this.buyers.findOneBy({ id, storeId })
      : null;
    if (!buyer) throw new AppException(HttpStatus.NOT_FOUND, BUYER_NOT_FOUND);
    return {
      id: buyer.id,
      name: buyer.name,
      whatsappNumber: buyer.whatsappNumber,
    };
  }

  /** Delete a buyer no listing links; a link makes the foreign key refuse. */
  async remove(storeId: string, id: string): Promise<void> {
    await withConflicts(
      () =>
        this.dataSource.transaction(async (manager) => {
          // Listings are always locked before buyers, so this cannot deadlock
          // with a sale write or a merge.
          await lockBuyerListings(manager, storeId, id);
          const { affected } = await manager
            .getRepository(Buyer)
            .delete({ id, storeId });
          if (!affected) {
            throw new AppException(HttpStatus.NOT_FOUND, BUYER_NOT_FOUND);
          }
        }),
      { "23503": HAS_ITEMS },
    );
  }

  /**
   * Move every listing of `sourceId` to `targetId`, give the target the
   * source's phone when it has none, and delete the source.
   */
  async merge(
    storeId: string,
    sourceId: string,
    targetId: string,
  ): Promise<BuyerResponse> {
    if (sourceId === targetId) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, SAME_BUYER);
    }
    return withConflicts(
      () =>
        this.dataSource.transaction(async (manager) => {
          await lockBuyerListings(manager, storeId, sourceId);
          const buyers = await manager
            .getRepository(Buyer)
            .createQueryBuilder("b")
            .setLock("pessimistic_write")
            .where("b.store_id = :storeId AND b.id IN (:...ids)", {
              storeId,
              ids: [sourceId, targetId],
            })
            .orderBy("b.id")
            .getMany();
          const source = buyers.find((b) => b.id === sourceId);
          const target = buyers.find((b) => b.id === targetId);
          if (!source) {
            throw new AppException(HttpStatus.NOT_FOUND, BUYER_NOT_FOUND);
          }
          if (!target)
            throw new AppException(HttpStatus.CONFLICT, BUYER_NOT_IN_STORE);

          await manager
            .getRepository(Listing)
            .update({ buyerId: sourceId, storeId }, { buyerId: targetId });
          target.whatsappNumber ??= source.whatsappNumber;
          await manager
            .getRepository(Buyer)
            .update(
              { id: targetId },
              { whatsappNumber: target.whatsappNumber },
            );
          await manager.getRepository(Buyer).delete({ id: sourceId });
          return {
            id: target.id,
            name: target.name,
            whatsappNumber: target.whatsappNumber,
          };
        }),
      {},
    );
  }
}
