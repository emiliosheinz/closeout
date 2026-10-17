import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Store } from "@/stores/entities/store.entity";
import { Listing } from "./listing.entity";

/**
 * Metadata for one processed photo. The binary variants live in media
 * storage under `storageKey`; position 0 is the cover.
 */
@Entity({ name: "listing_images" })
@Index("listing_images_listing_idx", ["listingId", "position"])
// Deferred so a reorder can swap positions inside one transaction.
@Unique("listing_images_listing_position_uq", ["listingId", "position"], {
  deferrable: "INITIALLY DEFERRED",
})
export class ListingImage {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "store_id", type: "uuid" })
  declare storeId: string;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  @JoinColumn({ name: "store_id" })
  declare store: Store;

  @Column({ name: "listing_id", type: "uuid" })
  declare listingId: string;

  @ManyToOne(
    () => Listing,
    (listing) => listing.images,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "listing_id" })
  declare listing: Listing;

  @Column({ name: "storage_key", type: "uuid", unique: true })
  declare storageKey: string;

  @Column({ type: "int" })
  declare position: number;

  @Column({ type: "int" })
  declare width: number;

  @Column({ type: "int" })
  declare height: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;
}
