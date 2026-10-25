import type {
  Availability,
  Condition,
  Publication,
} from "@closeout/contracts/enums";
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Category } from "@/stores/entities/category.entity";
import { Store } from "@/stores/entities/store.entity";
import type { ListingAttribute } from "../listing-types";
import { ListingImage } from "./listing-image.entity";
import { ListingSeller } from "./listing-seller.entity";

/**
 * An item for sale. Publication (who can see it) and availability (can it
 * still be bought) are independent axes. `slug` is minted once at creation
 * and never rewritten, so shared links survive title edits.
 */
@Entity({ name: "listings" })
@Unique("listings_store_slug_uq", ["storeId", "slug"])
@Index("listings_public_idx", [
  "storeId",
  "publication",
  "availability",
  "publishedAt",
])
@Index("listings_category_idx", ["storeId", "categoryId"])
@Check(
  "listings_condition_valid",
  `"condition" IN ('new', 'like_new', 'good', 'fair', 'for_parts')`,
)
@Check(
  "listings_availability_valid",
  `"availability" IN ('available', 'reserved', 'sold')`,
)
@Check(
  "listings_publication_valid",
  `"publication" IN ('draft', 'published', 'archived')`,
)
@Check(
  "listings_published_has_date",
  `"publication" <> 'published' OR "published_at" IS NOT NULL`,
)
@Check(
  "listings_price_non_negative",
  `"price_cents" IS NULL OR "price_cents" >= 0`,
)
export class Listing {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "store_id", type: "uuid" })
  declare storeId: string;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  @JoinColumn({ name: "store_id" })
  declare store: Store;

  @Column({ name: "category_id", type: "uuid" })
  declare categoryId: string;

  @ManyToOne(() => Category, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "category_id" })
  declare category: Category;

  @Column({ type: "text" })
  declare slug: string;

  @Column({ type: "text" })
  declare title: string;

  @Column({ type: "text", default: "" })
  declare description: string;

  @Column({ name: "price_cents", type: "int", nullable: true })
  declare priceCents: number | null;

  @Column({ type: "text" })
  declare condition: Condition;

  @Column({ type: "text", default: "available" })
  declare availability: Availability;

  @Column({ type: "text", default: "draft" })
  declare publication: Publication;

  @Column({ type: "jsonb", default: () => "'[]'" })
  declare attributes: ListingAttribute[];

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  declare publishedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;

  @OneToMany(
    () => ListingImage,
    (image) => image.listing,
  )
  declare images: ListingImage[];

  @OneToMany(
    () => ListingSeller,
    (listingSeller) => listingSeller.listing,
  )
  declare sellers: ListingSeller[];
}
