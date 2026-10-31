import {
  type Buyer as BuyerResponse,
  type BuyerSummary,
  type BuyerUpdateRequest,
  buyerNameKey,
} from "@closeout/contracts/schemas";
import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { type DataSource, QueryFailedError, type Repository } from "typeorm";
import { Listing } from "@/catalog/entities/listing.entity";
import { visibleToActor } from "@/catalog/listing-queries";
import { AppException } from "@/problem/app-exception";
import type { MembershipContext } from "@/stores/membership";
import { Buyer } from "../entities/buyer.entity";

const BUYER_NOT_FOUND = "Comprador não encontrado.";
const NAME_TAKEN = "Já existe um comprador com esse nome. Use Juntar com...";

const HAS_ITEMS =
  "Este comprador tem itens vinculados em anúncios da loja. Junte-o a outro comprador.";
const TARGET_GONE =
  "Esse comprador foi juntado ou removido. Escolha o comprador de novo.";
const SAME_BUYER = "Escolha outro comprador para juntar.";
const TRY_AGAIN = "Não foi possível salvar agora. Tente de novo.";

/** Turns the listed driver error codes, and a deadlock, into a 409. */
async function withConflicts<T>(
  run: () => Promise<T>,
  messages: Record<string, string>,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const code =
      err instanceof QueryFailedError
        ? (err.driverError as { code?: string }).code
        : undefined;
    const message = code === "40P01" ? TRY_AGAIN : code && messages[code];
    if (message) throw new AppException(HttpStatus.CONFLICT, message);
    throw err;
  }
}

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

  async update(
    storeId: string,
    id: string,
    patch: BuyerUpdateRequest,
  ): Promise<BuyerResponse> {
    const buyer = await this.buyers.findOneBy({ id, storeId });
    if (!buyer) throw new AppException(HttpStatus.NOT_FOUND, BUYER_NOT_FOUND);
    if (patch.name !== undefined) {
      buyer.name = patch.name;
      buyer.nameKey = buyerNameKey(patch.name);
    }
    if (patch.whatsappNumber !== undefined) {
      buyer.whatsappNumber = patch.whatsappNumber;
    }
    await withConflicts(() => this.buyers.save(buyer), {
      "23505": NAME_TAKEN,
    });
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
          await manager.query(
            `SELECT id FROM listings WHERE buyer_id = $1 AND store_id = $2 ORDER BY id FOR UPDATE`,
            [id, storeId],
          );
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
          await manager.query(
            `SELECT id FROM listings WHERE buyer_id = $1 AND store_id = $2 ORDER BY id FOR UPDATE`,
            [sourceId, storeId],
          );
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
          if (!target) throw new AppException(HttpStatus.CONFLICT, TARGET_GONE);

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
