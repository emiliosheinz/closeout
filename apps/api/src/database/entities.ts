import { Session } from "@/auth/entities/session.entity";
import { User } from "@/auth/entities/user.entity";
import { Listing } from "@/catalog/entities/listing.entity";
import { ListingImage } from "@/catalog/entities/listing-image.entity";
import { ListingSeller } from "@/catalog/entities/listing-seller.entity";
import { StoreInvite } from "@/invites/entities/store-invite.entity";
import { Seller } from "@/sellers/entities/seller.entity";
import { Category } from "@/stores/entities/category.entity";
import { Store } from "@/stores/entities/store.entity";
import { StoreMember } from "@/stores/entities/store-member.entity";
import { WaitlistSignup } from "@/waitlist/entities/waitlist-signup.entity";

export const ENTITIES = [
  User,
  Session,
  Store,
  StoreMember,
  Category,
  Seller,
  Listing,
  ListingImage,
  ListingSeller,
  StoreInvite,
  WaitlistSignup,
];
