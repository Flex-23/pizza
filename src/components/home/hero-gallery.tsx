"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pizza } from "lucide-react";

import { localeMeta, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** How long each image holds before the next one takes over. */
const HOLD_MS = 5000;

/**
 * Frame size.
 *
 * Phone and tablet keep a fixed portrait/square ratio — the column is the whole
 * screen there, so the shape is what matters. From `lg` up the ratio is dropped
 * for a height measured against the viewport: a fixed ratio times a wide column
 * computes taller than a laptop screen, which pushed the buttons below the fold
 * while the same page looked right on a large monitor. The cap per breakpoint
 * keeps the frame growing with the screen instead of stopping at one size.
 */
const FRAME =
  "aspect-4/5 sm:aspect-square lg:aspect-auto lg:h-[min(76vh,40rem)] xl:h-[min(78vh,46rem)] 2xl:h-[min(80vh,52rem)]";

/**
 * The rotating gallery beside the hero copy.
 *
 * Two things happen at once: the visible image drifts and grows very slowly
 * (a Ken Burns move, so a still photo never looks frozen), and the next one
 * arrives behind a mask that wipes across the frame instead of a plain fade.
 * A smaller card in the corner previews what is coming, which gives the block
 * some depth and makes it read as a gallery rather than a single banner.
 *
 * Images come from the dashboard, so every count has to look deliberate: none
 * at all, exactly one, or several.
 */
export function HeroGallery({ images }: { images: string[] }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  const count = images.length;
  const hasRotation = count > 1;

  // clip-path knows nothing about writing direction, so the wipe has to be
  // told which edge to start from: it should always travel with the text.
  const isRtl = localeMeta[locale as Locale]?.dir === "rtl";
  const hiddenClip = isRtl ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";

  const goTo = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (!hasRotation) return;

    const timer = setInterval(
      () => setIndex((current) => (current + 1) % count),
      HOLD_MS,
    );
    return () => clearInterval(timer);
  }, [count, hasRotation, index]);

  if (count === 0) {
    return (
      <div
        className={cn(
          "relative isolate flex w-full items-center justify-center overflow-hidden rounded-[2rem] border border-dashed border-border/80 bg-linear-to-br from-accent/40 via-muted/30 to-background",
          FRAME,
        )}
        aria-hidden
      >
        <span className="flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Pizza className="size-10" />
        </span>
      </div>
    );
  }

  const nextIndex = (index + 1) % count;

  return (
    <div className="relative isolate w-full">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[2rem] bg-muted shadow-2xl ring-1 ring-foreground/10",
          FRAME,
        )}
        role="group"
        aria-roledescription="carousel"
        aria-label={t("galleryLabel")}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={images[index]}
            className="absolute inset-0"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { clipPath: hiddenClip, opacity: 1 }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { clipPath: "inset(0 0 0 0%)", opacity: 1 }
            }
            exit={{ opacity: 1 }}
            transition={{
              duration: reduceMotion ? 0.4 : 1.1,
              ease: [0.65, 0, 0.35, 1],
            }}
          >
            {/* The wipe reveals this layer; the slow scale runs underneath it. */}
            <motion.div
              className="absolute inset-0"
              initial={reduceMotion ? false : { scale: 1.12 }}
              animate={reduceMotion ? undefined : { scale: 1 }}
              transition={{ duration: HOLD_MS / 1000 + 1.5, ease: "linear" }}
            >
              <Image
                src={images[index]}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                priority={index === 0}
                className="object-cover"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Keeps the dots and the floating card legible over a bright photo. */}
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-foreground/45 via-transparent to-transparent"
          aria-hidden
        />

        {hasRotation && (
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
            {images.map((image, dot) => (
              <button
                key={image}
                type="button"
                onClick={() => goTo(dot)}
                aria-label={t("galleryGoTo", { number: dot + 1 })}
                aria-current={dot === index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  "focus-visible:ring-2 focus-visible:ring-background focus-visible:outline-none",
                  dot === index
                    ? "w-7 bg-background"
                    : "w-1.5 bg-background/55 hover:bg-background/80",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {hasRotation && (
        <motion.div
          aria-hidden
          className="absolute -bottom-6 -inset-s-5 hidden w-32 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-xl sm:block lg:w-40"
          initial={false}
          animate={reduceMotion ? undefined : { rotate: [-4, -1.5, -4] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative aspect-square w-full">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={images[nextIndex]}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Image
                  src={images[nextIndex]}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
