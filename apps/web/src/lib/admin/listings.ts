import { api } from "./client-api";
import type { AdminImage, AdminListingDetail } from "./types";

/** Matches the API's per-request upload limit. */
export const MAX_FILES_PER_UPLOAD = 8;

export interface ListingFields {
  title: string;
  description: string;
  categoryId: string;
  sellerIds: string[];
  priceCents: number | null;
  condition: string;
  attributes: { label: string; value: string }[];
}

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

/**
 * Create a listing, attach its photos and optionally publish it. The id is
 * reported as soon as the listing exists, so a later failure can continue
 * on that listing instead of creating a duplicate.
 */
export async function createListingWithPhotos(
  storeId: string,
  fields: ListingFields,
  files: File[],
  options: {
    publish: boolean;
    onCreated: (id: string) => void;
    onProgress: (message: string) => void;
  },
): Promise<string> {
  const created = await api<AdminListingDetail>(
    "POST",
    `/stores/${storeId}/listings`,
    fields,
  );
  options.onCreated(created.id);
  await uploadPhotos(storeId, created.id, files, ({ done, total }) =>
    options.onProgress(`Enviando fotos (${done} de ${total})...`),
  );
  if (options.publish) {
    await api("PATCH", `/stores/${storeId}/listings/${created.id}/status`, {
      publication: "published",
    });
  }
  return created.id;
}
