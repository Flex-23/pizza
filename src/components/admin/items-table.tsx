"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteItemAction,
  toggleItemFlagAction,
} from "@/app/actions/admin/items";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MASTER_ROUTES } from "@/lib/admin-path";
import { useActionResult } from "@/lib/actions/use-action-result";
import { formatPrice } from "@/lib/money";
import type { CategoryView } from "@/lib/schemas/category";
import type { MenuItemView } from "@/lib/schemas/menu-item";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function ItemsTable({
  items,
  categories,
}: {
  items: MenuItemView[];
  categories: CategoryView[];
}) {
  const t = useTranslations("admin.item");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { messageFor } = useActionResult();

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(ALL);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.nameDe])),
    [categories],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      if (categoryId !== ALL && item.categoryId !== categoryId) return false;
      if (!needle) return true;
      return `${item.nameAr} ${item.nameDe}`.toLowerCase().includes(needle);
    });
  }, [items, query, categoryId]);

  function handleToggle(
    item: MenuItemView,
    field: "isAvailable" | "isFeatured",
    value: boolean,
  ) {
    setPendingId(item.id);

    startTransition(async () => {
      const result = await toggleItemFlagAction({ id: item.id, field, value });
      setPendingId(null);

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }

      if (field === "isAvailable") {
        toast.success(value ? t("availabilityOn") : t("availabilityOff"));
      } else {
        toast.success(t("updated"));
      }
      router.refresh();
    });
  }

  async function handleDelete(item: MenuItemView) {
    const result = await deleteItemAction(item.id);

    if (!result.ok) {
      toast.error(messageFor(result.code));
      return;
    }

    toast.success(t("deleted"));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <Card className="items-center gap-3 border-dashed py-16 text-center">
        <UtensilsCrossed className="size-9 text-muted-foreground" aria-hidden />
        <p className="text-lg font-bold">{t("empty")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyBody")}
        </p>
        <Button
          className="mt-1 rounded-full"
          render={<Link href={MASTER_ROUTES.newItem} />}
        >
          <Plus data-icon="inline-start" />
          {t("new")}
        </Button>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-10 ps-10"
          />
        </div>

        <Select
          value={categoryId}
          onValueChange={(value) => setCategoryId(value ?? ALL)}
          items={[
            { value: ALL, label: tCommon("all") },
            ...categories.map((category) => ({
              value: category.id,
              label: category.nameDe,
            })),
          ]}
        >
          <SelectTrigger
            size="default"
            className="h-10 min-w-44"
            aria-label={t("filterCategory")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tCommon("all")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.nameDe}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="rounded-full"
          render={<Link href={MASTER_ROUTES.newItem} />}
        >
          <Plus data-icon="inline-start" />
          {t("new")}
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex flex-wrap items-center gap-3 p-3",
                !item.isAvailable && "bg-muted/40",
              )}
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <UtensilsCrossed
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 truncate font-bold">
                  {item.nameAr}
                  {item.isFeatured && (
                    <Star
                      className="size-3.5 shrink-0 fill-warning text-warning"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {categoryNames.get(item.categoryId) ?? "—"}
                  <span className="mx-1.5 opacity-50">·</span>
                  {item.nameDe}
                </span>
              </div>

              <div className="flex shrink-0 flex-col items-end leading-tight">
                {item.hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through tabular-nums">
                    {formatPrice(item.price)}
                  </span>
                )}
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    item.hasDiscount && "text-primary",
                  )}
                >
                  {formatPrice(item.finalPrice)}
                </span>
              </div>

              {item.hasDiscount && (
                <Badge className="shrink-0 bg-sale text-sale-foreground">
                  −{item.discountPercentage}%
                </Badge>
              )}

              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={item.isAvailable}
                  disabled={pendingId === item.id}
                  onCheckedChange={(next) =>
                    handleToggle(item, "isAvailable", next)
                  }
                  aria-label={t("available")}
                />

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tCommon("edit")}
                  render={<Link href={MASTER_ROUTES.editItem(item.id)} />}
                >
                  <Pencil />
                </Button>

                <ConfirmDialog
                  title={t("deleteConfirm", { name: item.nameAr })}
                  confirmLabel={tCommon("delete")}
                  cancelLabel={tCommon("cancel")}
                  onConfirm={() => handleDelete(item)}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label={tCommon("delete")}
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </Card>
    </>
  );
}
