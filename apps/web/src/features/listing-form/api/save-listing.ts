import type { Availability, Publication } from "@closeout/contracts/enums";
import { type ListingNotice, uploadPhotos } from "@/entities/listing";
import { ApiError, api, apiParsed, withId } from "@/shared/api";

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

export interface SaveOutcome {
  /** Null when the listing was created but the API's answer could not be read. */
  id: string | null;
  notice: ListingNotice;
}

export async function updateListing(
  storeId: string,
  id: string,
  fields: ListingFields & {
    availability: Availability;
    publication: Publication;
  },
  publish: boolean,
): Promise<SaveOutcome> {
  await api("PATCH", `/stores/${storeId}/listings/${id}`, fields);
  return { id, notice: publish ? "published" : "saved" };
}

/**
 * Create a listing, attach its photos and optionally publish it. Once the
 * listing exists, a failed upload or publish still resolves, with the notice
 * that sends the person to fix it, so a retry never creates a duplicate.
 */
export async function createListingWithPhotos(
  storeId: string,
  fields: ListingFields,
  files: File[],
  options: {
    publish: boolean;
    onProgress: (message: string) => void;
  },
): Promise<SaveOutcome> {
  const result = await apiParsed(
    "POST",
    `/stores/${storeId}/listings`,
    fields,
    withId,
  );
  // The listing exists but its id is unknown: photos and publishing cannot
  // follow, so say so instead of claiming a plain save.
  if (!result.parsed) {
    const incomplete = files.length > 0 || options.publish;
    return { id: null, notice: incomplete ? "upload-failed" : "saved" };
  }
  const { id } = result.data;
  try {
    await uploadPhotos(storeId, id, files, ({ done, total }) =>
      options.onProgress(`Enviando fotos (${done} de ${total})...`),
    );
    if (options.publish) {
      await api("PATCH", `/stores/${storeId}/listings/${id}/status`, {
        publication: "published",
      });
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    return { id, notice: "upload-failed" };
  }
  return { id, notice: options.publish ? "published" : "saved" };
}
