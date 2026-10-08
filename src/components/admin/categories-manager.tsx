"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  ShapesIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  toggleCategoryActiveAction,
  updateCategoryAction,
} from "@/app/actions/admin/categories";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useActionResult } from "@/lib/actions/use-action-result";
import {
  categoryInputSchema,
  type CategoryInput,
  type CategoryValues,
  type CategoryView,
} from "@/lib/schemas/category";
import { slugifyWithFallback } from "@/lib/schemas/common";

export function CategoriesManager({
  categories,
}: {
  categories: CategoryView[];
}) {
  const t = useTranslations("admin.category");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { messageFor } = useActionResult();

  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: CategoryView) {
    setEditing(category);
    setDialogOpen(true);
  }

  function handleToggleActive(category: CategoryView, next: boolean) {
    setPendingId(category.id);
    startTransition(async () => {
      const result = await toggleCategoryActiveAction(category.id, next);
      setPendingId(null);

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;

    const order = categories.map((entry) => entry.id);
    [order[index], order[target]] = [order[target], order[index]];

    startTransition(async () => {
      const result = await reorderCategoriesAction({ order });

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }
      toast.success(t("reordered"));
      router.refresh();
    });
  }

  async function handleDelete(category: CategoryView) {
    const result = await deleteCategoryAction(category.id);

    if (!result.ok) {
      toast.error(messageFor(result.code));
      return;
    }
    toast.success(t("deleted"));
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className="rounded-full" onClick={openCreate}>
          <Plus data-icon="inline-start" />
          {t("new")}
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-14 text-center">
          <ShapesIcon className="size-9 text-muted-foreground" aria-hidden />
          <p className="text-lg font-bold">{t("empty")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Button onClick={openCreate} className="mt-1 rounded-full">
            <Plus data-icon="inline-start" />
            {t("new")}
          </Button>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {categories.map((category, index) => (
              <li
                key={category.id}
                className="flex flex-wrap items-center gap-3 p-3 sm:p-4"
              >
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("moveUp")}
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("moveDown")}
                    disabled={index === categories.length - 1}
                    onClick={() => handleMove(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-bold">{category.nameDe}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    <code className="font-mono text-xs" dir="ltr">
                      {category.slug}
                    </code>
                  </span>
                </div>

                <Badge variant="secondary" className="shrink-0">
                  {t("itemsCount", { count: category.itemCount ?? 0 })}
                </Badge>

                <Switch
                  checked={category.isActive}
                  disabled={pendingId === category.id}
                  onCheckedChange={(next) => handleToggleActive(category, next)}
                  aria-label={t("active")}
                />

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tCommon("edit")}
                    onClick={() => openEdit(category)}
                  >
                    <Pencil />
                  </Button>

                  <ConfirmDialog
                    title={t("deleteConfirm", { name: category.nameDe })}
                    confirmLabel={tCommon("delete")}
                    cancelLabel={tCommon("cancel")}
                    onConfirm={() => handleDelete(category)}
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
        </Card>
      )}

      <CategoryDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        nextSortOrder={(categories.length + 1) * 10}
        onSaved={() => {
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  nextSortOrder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryView | null;
  nextSortOrder: number;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.category");
  const tCommon = useTranslations("common");
  const { messageFor, applyFieldErrors } = useActionResult<CategoryValues>();

  const form = useForm<CategoryValues, unknown, CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: {
      nameAr: category?.nameAr ?? "",
      nameDe: category?.nameDe ?? "",
      slug: category?.slug ?? "",
      imageUrl: category?.imageUrl ?? undefined,
      sortOrder: category?.sortOrder ?? nextSortOrder,
      isActive: category?.isActive ?? true,
    },
  });

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: CategoryInput) {
    const result = category
      ? await updateCategoryAction({ id: category.id, ...values })
      : await createCategoryAction(values);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);
      if (!handled || result.code !== "VALIDATION") {
        toast.error(messageFor(result.code));
      }
      return;
    }

    toast.success(category ? t("updated") : t("created"));
    onSaved();
  }

  /**
   * A category is asked for by one name now — the German one. The Arabic name
   * and the link are still columns the rest of the app reads, so they are
   * derived from it here rather than left empty. An existing category keeps
   * its link: that string is in the storefront's URLs and must not move under
   * a rename.
   */
  function handleGermanNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nameDe = event.target.value;

    setValue("nameAr", nameDe, { shouldValidate: true });

    if (!category) {
      setValue("slug", slugifyWithFallback(nameDe, nameDe), {
        shouldValidate: true,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? t("edit") : t("new")}</DialogTitle>
          <DialogDescription className="sr-only">
            {category ? t("edit") : t("new")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.nameDe || !!errors.nameAr}>
              <FieldLabel htmlFor="cat-name-de">{t("nameDe")}</FieldLabel>
              <Input
                id="cat-name-de"
                dir="ltr"
                aria-invalid={!!errors.nameDe}
                {...register("nameDe", { onChange: handleGermanNameChange })}
              />
              <FieldError errors={[errors.nameDe, errors.nameAr]} />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="cat-active">{t("active")}</FieldLabel>
              <Switch
                id="cat-active"
                defaultChecked={category?.isActive ?? true}
                onCheckedChange={(next) =>
                  setValue("isActive", next, { shouldDirty: true })
                }
              />
            </Field>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1 rounded-lg font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting && <Spinner />}
                {tCommon("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
