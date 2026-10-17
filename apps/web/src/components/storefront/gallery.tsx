"use client";

import { useRef, useState } from "react";
import type { PublicImage } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

/**
 * Swipeable photo strip (native scroll snapping) with thumbnails that jump
 * to a photo. Works by touch, mouse and keyboard.
 */
export function Gallery({
  images,
  title,
  sold,
}: {
  images: PublicImage[];
  title: string;
  sold: boolean;
}) {
  const track = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(0);

  const show = (index: number) => {
    const node = track.current;
    if (!node) return;
    node.scrollTo({ left: index * node.clientWidth, behavior: "smooth" });
    setCurrent(index);
  };

  return (
    <div>
      <section
        ref={track}
        onScroll={(event) => {
          const node = event.currentTarget;
          setCurrent(
            Math.round(node.scrollLeft / Math.max(node.clientWidth, 1)),
          );
        }}
        className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto rounded-xl bg-surface ring-1 ring-line scrollbar-none sm:aspect-[5/4] lg:aspect-[4/5]"
        aria-label={`Fotos de ${title}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: lets keyboard users scroll the strip.
        tabIndex={0}
      >
        {images.map((image, index) => (
          // biome-ignore lint/performance/noImgElement: variants are pre-sized by the API.
          <img
            key={image.lg}
            src={image.lg}
            srcSet={`${image.sm} 640w, ${image.lg} 1600w`}
            sizes="(min-width: 1024px) 55vw, 100vw"
            width={image.width}
            height={image.height}
            alt={`${title}, foto ${index + 1} de ${images.length}`}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : undefined}
            decoding="async"
            className={cn(
              "size-full shrink-0 snap-center object-contain",
              sold && "grayscale",
            )}
          />
        ))}
      </section>
      {images.length > 1 && (
        <ul
          className="mt-2 flex gap-2 overflow-x-auto p-1 scrollbar-none"
          aria-label="Escolher foto"
        >
          {images.map((image, index) => (
            <li key={image.sm}>
              <button
                type="button"
                onClick={() => show(index)}
                aria-label={`Ver foto ${index + 1}`}
                aria-current={current === index}
                className={cn(
                  "block size-16 overflow-hidden rounded-md ring-2 ring-offset-2 ring-offset-paper",
                  current === index
                    ? "ring-ink"
                    : "ring-transparent opacity-70 hover:opacity-100",
                )}
              >
                {/* biome-ignore lint/performance/noImgElement: thumbnail variant. */}
                <img
                  src={image.sm}
                  alt=""
                  width={64}
                  height={64}
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
