import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Seller } from "@/sellers/entities/seller.entity";
import { Listing } from "./listing.entity";

/**
 * Who sells a listing; a couple usually sells the same item together. Every
 * listing keeps at least one row here (enforced by the listings and sellers
 * services). Removing a seller removes their rows, which is why the sellers
 * service refuses to delete a listing's only seller first.
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
