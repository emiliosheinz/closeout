"use client";

import { adminImageSchema } from "@closeout/contracts/schemas";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AdminImage } from "@/entities/listing";
import { uploadPhotos } from "@/entities/listing";
import { ApiError, apiParsed, listOf, type WriteResult } from "@/shared/api";
import { cn } from "@/shared/lib/utils";

const MAX_PHOTOS = 20;
const imageList = listOf(adminImageSchema);

const changeImages = (method: "PUT" | "DELETE", path: string, body?: unknown) =>
  apiParsed(method, path, body, imageList);

/**
 * Photos of an existing listing: upload more, pick the cover (first
 * position), move photos left or right, delete. Buttons instead of
 * drag-and-drop so it works with touch, mouse and keyboard alike.
 */
export function PhotoManager({
  storeId,
  listingId,
  initialImages,
}: {
  storeId: string;
  listingId: string;
  initialImages: AdminImage[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  useEffect(() => setImages(initialImages), [initialImages]);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const base = `/stores/${storeId}/listings/${listingId}/images`;

  async function act(
    action: () => Promise<WriteResult<{ items: AdminImage[] }>>,
    success: string,
  ) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await action();
      if (result.parsed) setImages(result.data.items);
      setStatus({ text: success, error: false });
      router.refresh();
    } catch (err) {
      setStatus({
        text:
          err instanceof ApiError
            ? err.message
            : "Algo deu errado com as fotos.",
        error: true,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: File[]) {
    if (files.length === 0) return;
    await act(
      async () => {
        let latest = images;
        await uploadPhotos(
          storeId,
          listingId,
          files,
          ({ done, total, images: items }) => {
            // Keep the list in step with the server after every batch, so a
            // later failing batch cannot leave the screen behind the server.
            if (items) {
              latest = items;
              setImages(items);
            }
            setStatus({
              text: `Enviando ${done} de ${total}...`,
              error: false,
            });
          },
        );
        return { parsed: true, data: { items: latest } };
      },
      files.length === 1
        ? "Foto adicionada."
        : `${files.length} fotos adicionadas.`,
    );
  }

  function reorder(ids: string[], success: string) {
    return act(() => changeImages("PUT", `${base}/order`, { ids }), success);
  }

  function move(index: number, to: number) {
    const ids = images.map((image) => image.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(to, 0, moved);
    return reorder(ids, to === 0 ? "Capa atualizada." : "Ordem atualizada.");
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
        {images.length < MAX_PHOTOS && (
          <label
            className={cn(
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus",
              busy && "pointer-events-none opacity-50",
            )}
          >
            <Upload className="size-4" aria-hidden="true" />
            Adicionar fotos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                upload(
                  Array.from(event.target.files ?? []).slice(
                    0,
                    MAX_PHOTOS - images.length,
                  ),
                );
                event.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "mt-2 min-h-5 text-sm",
          status?.error ? "font-medium text-stamp" : "text-go",
        )}
      >
        {status?.text}
      </p>
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
                  onClick={() =>
                    act(
                      () => changeImages("DELETE", `${base}/${image.id}`),
                      "Foto removida.",
                    )
                  }
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
