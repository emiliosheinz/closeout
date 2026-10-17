"use client";

import { useEffect, useRef, useState } from "react";
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
  children,
}: {
  images: PublicImage[];
  title: string;
  sold: boolean;
  /** Overlays positioned over the main photo (status stamp, price). */
  children?: React.ReactNode;
}) {
  const track = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  currentRef.current = current;

  // A resize or rotation changes the slide width; without re-aligning, the
  // strip rests between two photos and shows a blank frame.
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      node.scrollTo({ left: currentRef.current * node.clientWidth });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const show = (index: number) => {
    const node = track.current;
    if (!node) return;
    node.scrollTo({ left: index * node.clientWidth, behavior: "smooth" });
    setCurrent(index);
  };

  return (
    <div>
      <div className="relative">
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
          <p
            className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-surface tabular-nums"
            aria-hidden="true"
          >
            {current + 1} / {images.length}
          </p>
        )}
        {children}
      </div>
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
