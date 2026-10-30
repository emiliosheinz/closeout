import type { AdminImage } from "@closeout/contracts/schemas";
import { mediaUrls } from "@/media/media-urls";
import type { ListingImage } from "./entities/listing-image.entity";

export function toAdminImage(image: ListingImage): AdminImage {
  const urls = mediaUrls(image.storageKey);
  return {
    id: image.id,
    position: image.position,
    width: image.width,
    height: image.height,
    urls: { sm: urls.sm, lg: urls.lg },
  };
}
