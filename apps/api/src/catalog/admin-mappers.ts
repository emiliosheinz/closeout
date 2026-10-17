import { mediaUrls } from "@/media/media-urls";
import type { ListingImage } from "./entities/listing-image.entity";

export interface AdminImage {
  id: string;
  position: number;
  width: number;
  height: number;
  urls: { sm: string; lg: string };
}

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
