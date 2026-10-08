import { cn } from "@/lib/utils";

/**
 * The restaurant's location on Google Maps.
 *
 * The URL lives in the settings row, not here — the manager pastes it in the
 * dashboard, where the whole `<iframe …>` snippet Google hands out is accepted
 * and reduced to its `src`. Renders nothing until one is set, so a fresh
 * install never shows an empty grey box.
 */
export function MapEmbed({
  src,
  title,
  className,
}: {
  src: string | undefined;
  title: string;
  className?: string;
}) {
  if (!src) return null;

  return (
    <div
      className={cn("w-full overflow-hidden rounded-xl bg-muted", className)}
    >
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="size-full border-0"
      />
    </div>
  );
}
