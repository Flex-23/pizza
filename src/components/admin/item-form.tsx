"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createItemAction,
  deleteItemAction,
  updateItemAction,
} from "@/app/actions/admin/items";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ImageUploader } from "@/components/admin/image-uploader";
import { FoodCard } from "@/components/menu/food-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MASTER_ROUTES } from "@/lib/admin-path";
import { useActionResult } from "@/lib/actions/use-action-result";
import { discountPercentage, effectivePrice } from "@/lib/money";
import type { CategoryView } from "@/lib/schemas/category";
import {
  menuItemInputSchema,
  type MenuItemInput,
  type MenuItemValues,
  type MenuItemView,
} from "@/lib/schemas/menu-item";

type DiscountMode = "none" | "percent" | "fixed";

export function ItemForm({
  categories,
  item,
}: {
  categories: CategoryView[];
  item?: MenuItemView;
}) {
  const t = useTranslations("admin.item");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { messageFor, applyFieldErrors } = useActionResult<MenuItemValues>();

  const [discountMode, setDiscountMode] = useState<DiscountMode>(() => {
    if (!item) return "none";
    if (item.hasDiscount && item.finalPrice !== item.price) {
      // The stored percent tells the two discount styles apart.
      return item.discountPercentage > 0 &&
        Math.abs(
          item.price * (1 - item.discountPercentage / 100) - item.finalPrice,
        ) < 0.02
        ? "percent"
        : "fixed";
    }
    return "none";
  });

  const form = useForm<MenuItemValues, unknown, MenuItemInput>({
    resolver: zodResolver(menuItemInputSchema),
    defaultValues: {
      categoryId: item?.categoryId ?? categories[0]?.id ?? "",
      nameAr: item?.nameAr ?? "",
      nameDe: item?.nameDe ?? "",
      descriptionAr: item?.descriptionAr ?? "",
      descriptionDe: item?.descriptionDe ?? "",
      price: item?.price ?? 0,
      discountPercent: item?.discountPercentage ?? 0,
      discountPrice: item && item.hasDiscount ? item.finalPrice : "",
      imageUrl: item?.imageUrl ?? "",
      isAvailable: item?.isAvailable ?? true,
      isFeatured: item?.isFeatured ?? false,
      allowCustomNote: item?.allowCustomNote ?? false,
      /* Tags, allergens and the display order left the form. They stay in the
         payload so an edit cannot silently wipe what a dish already carries —
         a new dish simply starts with none, and the menu orders by name. */
      tags: item?.tags.join(", ") ?? "",
      allergens: item?.allergens.join(", ") ?? "",
      sortOrder: item?.sortOrder ?? 0,
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const watched = useWatch({ control });

  // One German field per text: the value is entered and displayed in German, and
  // mirrored into the (retained) Arabic column so nothing that reads either
  // language — the storefront, the receipt, the master's own list — comes up
  // empty. The DB stays bilingual; only the input is single.
  function mirrorName(event: React.ChangeEvent<HTMLInputElement>) {
    setValue("nameAr", event.target.value, { shouldValidate: true });
  }
  function mirrorDescription(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue("descriptionAr", event.target.value);
  }

  // Live card preview — the same component the customer sees, so a discount
  // can never look one way here and another way on the storefront.
  const previewItem = useMemo<MenuItemView>(() => {
    const price = Number(watched.price) || 0;
    const percent =
      discountMode === "percent" ? Number(watched.discountPercent) || 0 : 0;
    const fixed =
      discountMode === "fixed" ? Number(watched.discountPrice) || null : null;

    const pricing = { price, discountPercent: percent, discountPrice: fixed };
    const finalPrice = effectivePrice(pricing);
    const percentage = discountPercentage(pricing);

    return {
      id: item?.id ?? "preview",
      categoryId: String(watched.categoryId ?? ""),
      categorySlug: "",
      nameAr: String(watched.nameAr ?? ""),
      nameDe: String(watched.nameDe ?? ""),
      descriptionAr: String(watched.descriptionAr ?? ""),
      descriptionDe: String(watched.descriptionDe ?? ""),
      price,
      finalPrice,
      discountPercentage: percentage,
      hasDiscount: percentage > 0,
      imageUrl: (watched.imageUrl as string) || null,
      isAvailable: Boolean(watched.isAvailable),
      isFeatured: Boolean(watched.isFeatured),
      allowCustomNote: Boolean(watched.allowCustomNote),
      tags: [],
      allergens: [],
      sortOrder: 0,
    };
  }, [watched, discountMode, item?.id]);

  async function onSubmit(values: MenuItemInput) {
    // Whichever discount style is off is cleared, so the two can never conflict.
    const payload: MenuItemInput = {
      ...values,
      discountPercent: discountMode === "percent" ? values.discountPercent : 0,
      discountPrice: discountMode === "fixed" ? values.discountPrice : null,
    };

    const result = item
      ? await updateItemAction({ id: item.id, data: payload })
      : await createItemAction(payload);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);
      if (!handled || result.code !== "VALIDATION") {
        toast.error(messageFor(result.code));
      }
      return;
    }

    toast.success(item ? t("updated") : t("created"));
    router.push(MASTER_ROUTES.items);
    router.refresh();
  }

  async function handleDelete() {
    if (!item) return;

    const result = await deleteItemAction(item.id);

    if (!result.ok) {
      toast.error(messageFor(result.code));
      return;
    }

    toast.success(t("deleted"));
    router.push(MASTER_ROUTES.items);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <FieldSet>
              <FieldLegend variant="label">{t("createTitle")}</FieldLegend>
              <FieldGroup>
                <Field data-invalid={!!errors.categoryId}>
                  <FieldLabel htmlFor="item-category">
                    {t("category")}
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value)}
                        items={categories.map((category) => ({
                          value: category.id,
                          label: category.nameDe,
                        }))}
                      >
                        <SelectTrigger id="item-category" className="w-full">
                          <SelectValue placeholder={t("selectCategory")} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.nameDe}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[errors.categoryId]} />
                </Field>

                <Field data-invalid={!!errors.nameDe || !!errors.nameAr}>
                  <FieldLabel htmlFor="item-name">{t("name")}</FieldLabel>
                  <Input
                    id="item-name"
                    dir="ltr"
                    aria-invalid={!!errors.nameDe || !!errors.nameAr}
                    {...register("nameDe", { onChange: mirrorName })}
                  />
                  <FieldError errors={[errors.nameDe, errors.nameAr]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="item-desc">
                    {t("description")}
                  </FieldLabel>
                  <Textarea
                    id="item-desc"
                    rows={3}
                    dir="ltr"
                    {...register("descriptionDe", {
                      onChange: mirrorDescription,
                    })}
                  />
                  <FieldError
                    errors={[errors.descriptionDe, errors.descriptionAr]}
                  />
                </Field>

                {/* Sits with the dish's own details rather than in the side
                    column of display switches: whether a dish can be customised
                    is a property of the food, and it is the one setting the
                    master has to notice while creating a new dish. Off by
                    default — most of the menu is fixed — so it is only ever
                    turned on deliberately. */}
                <Controller
                  control={control}
                  name="allowCustomNote"
                  render={({ field }) => (
                    <Field
                      orientation="horizontal"
                      className="rounded-xl border border-border bg-muted/30 p-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor="item-allow-note">
                          {t("allowCustomNote")}
                        </FieldLabel>
                        <p className="text-xs font-normal text-muted-foreground">
                          {t("allowCustomNoteHint")}
                        </p>
                      </div>
                      <Switch
                        id="item-allow-note"
                        checked={Boolean(field.value)}
                        onCheckedChange={(checked) => field.onChange(checked)}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
            </FieldSet>
          </Card>

          <Card className="p-5">
            <FieldSet>
              <FieldLegend variant="label">{t("price")}</FieldLegend>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={!!errors.price}>
                    <FieldLabel htmlFor="item-price">{t("price")}</FieldLabel>
                    <Input
                      id="item-price"
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      aria-invalid={!!errors.price}
                      {...register("price")}
                    />
                    <FieldError errors={[errors.price]} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="item-discount-mode">
                      {t("discountType")}
                    </FieldLabel>
                    <Select
                      value={discountMode}
                      onValueChange={(value) =>
                        setDiscountMode(value as DiscountMode)
                      }
                      items={[
                        { value: "none", label: t("discountNone") },
                        { value: "percent", label: t("discountPercent") },
                        { value: "fixed", label: t("discountFixed") },
                      ]}
                    >
                      <SelectTrigger id="item-discount-mode" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("discountNone")}
                        </SelectItem>
                        <SelectItem value="percent">
                          {t("discountPercent")}
                        </SelectItem>
                        <SelectItem value="fixed">
                          {t("discountFixed")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {discountMode === "percent" && (
                  <Field data-invalid={!!errors.discountPercent}>
                    <FieldLabel htmlFor="item-discount-percent">
                      {t("discountPercentValue")}
                    </FieldLabel>
                    <Input
                      id="item-discount-percent"
                      type="number"
                      min="0"
                      max="90"
                      dir="ltr"
                      aria-invalid={!!errors.discountPercent}
                      {...register("discountPercent")}
                    />
                    <FieldError errors={[errors.discountPercent]} />
                  </Field>
                )}

                {discountMode === "fixed" && (
                  <Field data-invalid={!!errors.discountPrice}>
                    <FieldLabel htmlFor="item-discount-price">
                      {t("discountPriceValue")}
                    </FieldLabel>
                    <Input
                      id="item-discount-price"
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      aria-invalid={!!errors.discountPrice}
                      {...register("discountPrice")}
                    />
                    <FieldError errors={[errors.discountPrice]} />
                  </Field>
                )}
              </FieldGroup>
            </FieldSet>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="gap-3 p-5">
            <FieldLegend variant="label">{t("image")}</FieldLegend>
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <ImageUploader
                  value={field.value || null}
                  onChange={(url) => field.onChange(url ?? "")}
                />
              )}
            />
          </Card>

          <Card className="gap-4 p-5">
            <Controller
              control={control}
              name="isAvailable"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="item-available">
                    {t("available")}
                  </FieldLabel>
                  <Switch
                    id="item-available"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="isFeatured"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="item-featured">
                    {t("featured")}
                  </FieldLabel>
                  <Switch
                    id="item-featured"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                </Field>
              )}
            />
          </Card>

          <Card className="gap-3 p-5">
            <div className="flex flex-col gap-0.5">
              <FieldLegend variant="label">{t("preview")}</FieldLegend>
              <p className="text-xs text-muted-foreground">
                {t("previewHint")}
              </p>
            </div>
            <div className="pointer-events-none">
              <FoodCard item={previewItem} canOrder={false} />
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-6 flex gap-2 border-t border-border bg-background/90 py-3 backdrop-blur-md">
        <Button
          type="submit"
          size="lg"
          className="rounded-lg font-bold"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner /> : <Save data-icon="inline-start" />}
          {tCommon("save")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          render={<Link href={MASTER_ROUTES.items} />}
        >
          {tCommon("cancel")}
        </Button>

        {item && (
          <ConfirmDialog
            title={t("deleteConfirm", { name: item.nameAr })}
            confirmLabel={tCommon("delete")}
            cancelLabel={tCommon("cancel")}
            onConfirm={handleDelete}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="ms-auto text-destructive"
              >
                <Trash2 data-icon="inline-start" />
                {tCommon("delete")}
              </Button>
            }
          />
        )}
      </div>
    </form>
  );
}
