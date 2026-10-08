"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadImageAction } from "@/app/actions/admin/upload";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActionResult } from "@/lib/actions/use-action-result";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/limits";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export function ImageUploader({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}) {
  const t = useTranslations("admin.item");
  const { messageFor } = useActionResult();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    // A photo straight from a phone can be 15 MB. Caught here it gets a proper
    // message; sent anyway it would be refused by the framework, before the
    // action — and that error carries no code to translate.
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(messageFor("UPLOAD_TOO_LARGE"));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadImageAction(formData);

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }

      onChange(result.data.url);
    } catch {
      // A dropped connection mid-upload must not leave the form stuck.
      toast.error(messageFor("UPLOAD_FAILED"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value ? (
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-muted">
          <Image
            src={value}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Spinner className="size-6" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={uploading}
          className={cn(
            "flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/40 hover:border-primary/50 hover:bg-muted",
          )}
        >
          {uploading ? (
            <>
              <Spinner className="size-6" />
              <span className="text-sm text-muted-foreground">
                {t("uploading")}
              </span>
            </>
          ) : (
            <>
              <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
              <span className="text-sm font-semibold">{t("uploadImage")}</span>
              <span className="text-xs text-muted-foreground">
                JPG · PNG · WEBP · AVIF
              </span>
            </>
          )}
        </button>
      )}

      {value && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {t("changeImage")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={uploading}
            onClick={() => onChange(null)}
          >
            <Trash2 data-icon="inline-start" />
            {t("removeImage")}
          </Button>
        </div>
      )}
    </div>
  );
}
