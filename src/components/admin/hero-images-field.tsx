"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { uploadImageAction } from "@/app/actions/admin/upload";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActionResult } from "@/lib/actions/use-action-result";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/limits";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_IMAGES = 10;

/**
 * The home-page gallery, ordered.
 *
 * Order matters — the first image is the one a visitor sees before the rotation
 * starts — so the arrows move an image one place rather than offering
 * drag-and-drop, which is awkward on the phone the manager actually uses.
 */
export function HeroImagesField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("admin.settings");
  const tItem = useTranslations("admin.item");
  const { messageFor } = useActionResult();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isFull = value.length >= MAX_IMAGES;

  async function uploadAll(files: File[]) {
    const room = MAX_IMAGES - value.length;
    if (room <= 0) return;

    setUploading(true);
    const uploaded: string[] = [];

    try {
      for (const file of files.slice(0, room)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(messageFor("UPLOAD_TOO_LARGE"));
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
          const result = await uploadImageAction(formData);
          if (!result.ok) {
            toast.error(messageFor(result.code));
            continue;
          }
          uploaded.push(result.data.url);
        } catch {
          toast.error(messageFor("UPLOAD_FAILED"));
        }
      }

      if (uploaded.length > 0) onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;

    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void uploadAll(files);
        }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((url, index) => (
          <figure
            key={url}
            className="group relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-muted"
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 200px"
              className="object-cover"
            />

            <span className="absolute inset-s-2 top-2 flex size-6 items-center justify-center rounded-full bg-background/85 text-xs font-bold tabular-nums backdrop-blur-sm">
              {index + 1}
            </span>

            <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/85 p-1 backdrop-blur-sm">
              <span className="flex gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("heroImageMoveStart")}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowRight className="rtl:rotate-0 ltr:rotate-180" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("heroImageMoveEnd")}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowLeft className="rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-destructive"
                aria-label={tItem("removeImage")}
                onClick={() => onChange(value.filter((entry) => entry !== url))}
              >
                <Trash2 />
              </Button>
            </figcaption>
          </figure>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || isFull}
          className={cn(
            "flex aspect-4/3 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 transition-colors",
            "hover:border-primary/50 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Spinner className="size-6" />
          ) : (
            <ImagePlus className="size-7 text-muted-foreground" aria-hidden />
          )}
          <span className="text-xs font-semibold">
            {uploading ? tItem("uploading") : t("heroImageAdd")}
          </span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("heroImagesHint", { max: MAX_IMAGES })}
      </p>
    </div>
  );
}
