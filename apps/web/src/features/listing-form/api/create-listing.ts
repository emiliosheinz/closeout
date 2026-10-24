import { type AdminListingDetail, uploadPhotos } from "@/entities/listing";
import { api } from "@/shared/api";

export interface ListingFields {
  title: string;
  description: string;
  categoryId: string;
  /** Omitted for sellers: the API assigns their own profile. */
  sellerIds?: string[];
  priceCents: number | null;
  condition: string;
  attributes: { label: string; value: string }[];
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
