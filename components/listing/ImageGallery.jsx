"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Photo gallery. On a phone it is a full-width swipeable strip (native
 * scroll-snap, so it feels like every other app) with a "2 / 5" counter; on
 * larger screens it adds arrows and a thumbnail row. Tapping the photo calls
 * `onOpen` (the full-screen viewer). It is controlled: the parent owns
 * `activeIndex`, so the full-screen viewer and this stay in step.
 */
export default function ImageGallery({ images = [], name = "", activeIndex = 0, onChange, onOpen }) {
  const scroller = useRef(null);
  const settling = useRef(false);
  const urls = images.map((img) => img?.url || img).filter(Boolean);
  const count = urls.length;

  // Follow activeIndex when it is changed from outside (arrows, thumbnails, viewer).
  useEffect(() => {
    const el = scroller.current;
    if (!el || !count) return;
    const width = el.clientWidth;
    if (Math.round(el.scrollLeft / width) === activeIndex) return;
    settling.current = true;
    el.scrollTo({ left: activeIndex * width, behavior: "smooth" });
    const t = setTimeout(() => (settling.current = false), 450);
    return () => clearTimeout(t);
  }, [activeIndex, count]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || settling.current || !count) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== activeIndex && index >= 0 && index < count) onChange?.(index);
  };

  const go = (delta) => onChange?.((activeIndex + delta + count) % count);

  if (!count) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-slate-400 md:rounded-2xl">
        No photos yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-b-3xl bg-slate-100 md:rounded-2xl">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {urls.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={onOpen}
              aria-label={`Open photo ${i + 1} of ${count}`}
              className="relative h-full w-full shrink-0 snap-center cursor-zoom-in"
            >
              <Image
                src={src}
                alt={i === 0 ? name : `${name} — photo ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>

        {count > 1 && (
          <>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur">
              {activeIndex + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white active:scale-95 md:flex md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white active:scale-95 md:flex md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        <span className="pointer-events-none absolute left-3 top-3 hidden items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100 md:flex">
          <Expand className="h-3 w-3" /> Click to enlarge
        </span>
      </div>

      {count > 1 && (
        <>
          {/* dots on phones */}
          <div className="flex justify-center gap-1.5 md:hidden" aria-hidden>
            {urls.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === activeIndex ? "w-5 bg-primary" : "w-1.5 bg-slate-300"
                )}
              />
            ))}
          </div>
          {/* thumbnails on larger screens */}
          <div className="hidden gap-2 overflow-x-auto pb-1 md:flex">
            {urls.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => onChange?.(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === activeIndex}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition",
                  i === activeIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
