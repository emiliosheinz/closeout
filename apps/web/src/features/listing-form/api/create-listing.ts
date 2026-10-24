import { uploadPhotos } from "@/entities/listing";
import { api, apiParsed, withId } from "@/shared/api";

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
 * on that listing instead of creating a duplicate. Resolves null when the
 * listing was created but the API's answer could not be read.
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
): Promise<string | null> {
  const result = await apiParsed(
    "POST",
    `/stores/${storeId}/listings`,
    fields,
    withId,
  );
  // The listing exists but its id is unknown: carrying on would mean guessing,
  // and a retry would create a duplicate.
  if (!result.parsed) return null;
  const created = result.data;
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
