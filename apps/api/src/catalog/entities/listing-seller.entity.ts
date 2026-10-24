import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Seller } from "@/sellers/entities/seller.entity";
import { Listing } from "./listing.entity";

/**
 * Who sells a listing; a couple usually sells the same item together. Every
 * listing keeps at least one row here (enforced by the listings and team
 * services). Removing a member removes their profile's rows, which is why
 * team removal refuses while they are a listing's only seller.
 */
@Entity({ name: "listing_sellers" })
@Index("listing_sellers_seller_idx", ["sellerId"])
export class ListingSeller {
  @PrimaryColumn({ name: "listing_id", type: "uuid" })
  declare listingId: string;

  @PrimaryColumn({ name: "seller_id", type: "uuid" })
  declare sellerId: string;

  @ManyToOne(
    () => Listing,
    (listing) => listing.sellers,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "listing_id" })
  declare listing: Listing;

  @ManyToOne(() => Seller, { onDelete: "CASCADE" })
  @JoinColumn({ name: "seller_id" })
  declare seller: Seller;
}
