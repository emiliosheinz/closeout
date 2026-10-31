import type { StoreRole } from "@closeout/contracts/enums";
import type { Repository, SelectQueryBuilder } from "typeorm";
import { isManager } from "@/stores/roles";
import type { Listing } from "./entities/listing.entity";

/** The actor's store, narrowed to their assigned listings for sellers. */
export function visibleListings(
  listings: Repository<Listing>,
  actor: { storeId: string; role: StoreRole; sellerId: string },
): SelectQueryBuilder<Listing> {
  const query = listings
    .createQueryBuilder("l")
    .where("l.store_id = :storeId", { storeId: actor.storeId });
  if (isManager(actor.role)) return query;
  return query.andWhere(
    `EXISTS (SELECT 1 FROM listing_sellers assigned
              WHERE assigned.listing_id = l.id
                AND assigned.seller_id = :actorSellerId)`,
    { actorSellerId: actor.sellerId },
  );
}
