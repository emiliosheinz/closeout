import type { StoreRole } from "@closeout/contracts/enums";
import type { Repository, SelectQueryBuilder } from "typeorm";
import { isManager } from "@/stores/roles";
import type { Listing } from "./entities/listing.entity";

type Actor = { storeId: string; role: StoreRole; sellerId: string };

/** SQL over a listing aliased `l` that holds for the listings the actor may see. */
export function visibleToActor(actor: Actor): {
  sql: string;
  params: Record<string, string>;
} {
  const store = {
    sql: "l.store_id = :storeId",
    params: { storeId: actor.storeId },
  };
  if (isManager(actor.role)) return store;
  return {
    sql: `${store.sql} AND EXISTS (SELECT 1 FROM listing_sellers assigned
              WHERE assigned.listing_id = l.id
                AND assigned.seller_id = :actorSellerId)`,
    params: { ...store.params, actorSellerId: actor.sellerId },
  };
}

/** The actor's store, narrowed to their assigned listings for sellers. */
export function visibleListings(
  listings: Repository<Listing>,
  actor: Actor,
): SelectQueryBuilder<Listing> {
  const { sql, params } = visibleToActor(actor);
  return listings.createQueryBuilder("l").where(sql, params);
}
