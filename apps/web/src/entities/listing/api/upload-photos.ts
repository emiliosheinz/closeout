import { api } from "@/shared/api";
import type { AdminImage } from "../model/types";

/** Matches the API's per-request upload limit. */
export const MAX_FILES_PER_UPLOAD = 8;

/** Upload photos in API-sized batches, reporting progress and each batch's result. */
export async function uploadPhotos(
  storeId: string,
  listingId: string,
  files: File[],
  onBatch: (progress: {
    done: number;
    total: number;
    images: AdminImage[];
  }) => void,
): Promise<void> {
  for (let i = 0; i < files.length; i += MAX_FILES_PER_UPLOAD) {
    const body = new FormData();
    for (const file of files.slice(i, i + MAX_FILES_PER_UPLOAD)) {
      body.append("files", file);
    }
    const { items } = await api<{ items: AdminImage[] }>(
      "POST",
      `/stores/${storeId}/listings/${listingId}/images`,
      body,
    );
    onBatch({
      done: Math.min(i + MAX_FILES_PER_UPLOAD, files.length),
      total: files.length,
      images: items,
    });
  }
}
