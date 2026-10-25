export const MAX_PHOTOS = 20;

export const ACCEPTED_PHOTO_TYPES = {
  "image/jpeg": [],
  "image/png": [],
  "image/webp": [],
};

export interface PhotoDropPlan {
  /** Files to upload: the accepted ones that fit the remaining capacity. */
  upload: File[];
  /** One message per problem, in the order they should be shown. */
  errors: string[];
}

/**
 * Splits a drop into what uploads and what is reported. Files beyond the
 * listing's remaining capacity are skipped, not the whole drop.
 */
export function planPhotoDrop(
  accepted: File[],
  rejectedNames: string[],
  existing: number,
): PhotoDropPlan {
  const capacity = Math.max(0, MAX_PHOTOS - existing);
  const skipped = accepted.length - capacity;
  const errors = rejectedNames.map(
    (name) => `"${name}" não é JPEG, PNG ou WebP.`,
  );
  if (skipped > 0) {
    errors.push(
      skipped === 1
        ? `1 foto não enviada: limite de ${MAX_PHOTOS}.`
        : `${skipped} fotos não enviadas: limite de ${MAX_PHOTOS}.`,
    );
  }
  return { upload: accepted.slice(0, capacity), errors };
}
