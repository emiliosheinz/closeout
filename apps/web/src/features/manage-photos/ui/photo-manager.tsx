"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Star, Trash2 } from "lucide-react";
import {
  listingKeys,
  listingReads,
  MAX_PHOTOS,
  PhotoDropzone,
  uploadPhotos,
} from "@/entities/listing";
import { api, readQuery, successFor } from "@/shared/api";
import { notify } from "@/shared/ui/sonner";

class PartialUploadError extends Error {
  constructor(
    readonly sent: number,
    readonly total: number,
  ) {
    super(`${sent} of ${total} photos uploaded`);
  }
}

/**
 * Photos of an existing listing: upload more (drop or pick), pick the cover
 * (first position), move photos left or right, delete. Buttons instead of
 * drag-and-drop reordering so it works with touch, mouse and keyboard alike.
 * The grid always shows the server's list: every change refetches it.
 */
export function PhotoManager({
  storeId,
  listingId,
}: {
  storeId: string;
  listingId: string;
}) {
  const queryClient = useQueryClient();
  const { data: listing } = useSuspenseQuery(
    readQuery(listingReads.detail(storeId, listingId)),
  );
  const images = listing.images;
  const base = `/stores/${storeId}/listings/${listingId}/images`;
  const refreshed = [
    listingKeys.detail(storeId, listingId),
    listingKeys.list(storeId),
  ];

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let sent = 0;
      try {
        await uploadPhotos(storeId, listingId, files, ({ done }) => {
          sent = done;
        });
      } catch (error) {
        if (sent > 0) throw new PartialUploadError(sent, files.length);
        throw error;
      }
    },
    meta: {
      success: successFor((files: File[]) =>
        files.length === 1
          ? "Foto adicionada."
          : `${files.length} fotos adicionadas.`,
      ),
      handlesError: (error) => error instanceof PartialUploadError,
    },
    onError: (error) => {
      if (error instanceof PartialUploadError) {
        notify.error(
          `${error.sent} de ${error.total} fotos enviadas. Tente enviar as outras de novo.`,
        );
      }
    },
    // Photos may have been stored even when the call failed.
    onSettled: () =>
      Promise.all(
        refreshed.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
  const reorder = useMutation({
    mutationFn: ({ ids }: { ids: string[]; cover: boolean }) =>
      api("PUT", `${base}/order`, { ids }),
    meta: {
      success: successFor(({ cover }: { cover: boolean }) =>
        cover ? "Capa atualizada." : "Ordem atualizada.",
      ),
      invalidates: refreshed,
    },
  });
  const remove = useMutation({
    mutationFn: (imageId: string) => api("DELETE", `${base}/${imageId}`),
    meta: { success: "Foto removida.", invalidates: refreshed },
  });
  const busy = upload.isPending || reorder.isPending || remove.isPending;

  function move(index: number, to: number) {
    const ids = images.map((image) => image.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(to, 0, moved);
    reorder.mutate({ ids, cover: to === 0 });
  }

  return (
    <section aria-labelledby="photos-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="photos-heading" className="text-lg font-bold">
          Fotos{" "}
          <span className="font-normal text-muted">
            ({images.length} de {MAX_PHOTOS})
          </span>
        </h2>
      </div>
      <div className="mt-3">
        <PhotoDropzone
          existing={images.length}
          onFiles={upload.mutate}
          disabled={busy}
        />
      </div>
      {images.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-soft">
          Sem fotos ainda. Anúncios publicados precisam de pelo menos uma.
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-lg border border-line bg-surface"
            >
              <div className="relative aspect-square">
                {/* biome-ignore lint/performance/noImgElement: pre-sized variant. */}
                <img
                  src={image.urls.sm}
                  alt={`Foto ${index + 1}`}
                  className="size-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-sticker px-2.5 py-0.5 text-xs font-bold text-sticker-ink">
                    Capa
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between p-1">
                <div className="flex">
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Mover foto ${index + 1} para a esquerda`}
                    className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === images.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Mover foto ${index + 1} para a direita`}
                    className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30"
                  >
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                  {index > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(index, 0)}
                      aria-label={`Usar foto ${index + 1} como capa`}
                      className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
                    >
                      <Star className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove.mutate(image.id)}
                  aria-label={`Remover foto ${index + 1}`}
                  className="inline-flex size-11 items-center justify-center rounded-full text-stamp hover:bg-stamp/10"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
