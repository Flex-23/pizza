"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { saveSettingsAction } from "@/app/actions/admin/settings";
import { HeroImagesField } from "@/components/admin/hero-images-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useActionResult } from "@/lib/actions/use-action-result";
import { cn } from "@/lib/utils";
import {
  settingsSchema,
  WEEKDAYS,
  type SettingsInput,
  type SettingsValues,
  type SettingsView,
} from "@/lib/schemas/settings";

export function SettingsForm({
  settings,
  isMaster,
}: {
  settings: SettingsView;
  /** The paper width is the owner's call, so the field only renders for them. */
  isMaster: boolean;
}) {
  const t = useTranslations("admin.settings");
  const tCommon = useTranslations("common");
  const tHours = useTranslations("hours");
  const tStatus = useTranslations("status");
  const { messageFor, applyFieldErrors } = useActionResult<SettingsValues>();

  const form = useForm<SettingsValues, unknown, SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      isOpen: settings.isOpen,
      isPaypalEnabled: settings.isPaypalEnabled,
      promoBannerEnabled: settings.promoBannerEnabled,
      promoBannerAr: settings.promoBannerAr ?? "",
      promoBannerDe: settings.promoBannerDe ?? "",
      heroImages: settings.heroImages ?? [],
      minOrderValue: settings.minOrderValue,
      receiptWidthMm: settings.receiptWidthMm,
      deliveryFee: settings.deliveryFee,
      freeDeliveryFrom: settings.freeDeliveryFrom ?? "",
      restaurantNameAr: settings.restaurantNameAr,
      restaurantNameDe: settings.restaurantNameDe,
      street: settings.street,
      postalCode: settings.postalCode,
      city: settings.city,
      phone: settings.phone,
      phone2: settings.phone2 ?? "",
      fax: settings.fax ?? "",
      email: settings.email ?? "",
      facebookUrl: settings.facebookUrl ?? "",
      mapEmbedUrl: settings.mapEmbedUrl ?? "",
      salesUrl: settings.salesUrl ?? "",
      openingHours: WEEKDAYS.map((day) => {
        const existing = settings.openingHours.find(
          (entry) => entry.day === day,
        );
        return (
          existing ?? { day, open: "12:00", close: "23:00", isClosed: true }
        );
      }),
      termsAr: settings.termsAr ?? "",
      termsDe: settings.termsDe ?? "",
      privacyAr: settings.privacyAr ?? "",
      privacyDe: settings.privacyDe ?? "",
      allergensAr: settings.allergensAr ?? "",
      allergensDe: settings.allergensDe ?? "",
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

  async function onSubmit(values: SettingsInput) {
    const result = await saveSettingsAction(values);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);
      if (!handled || result.code !== "VALIDATION") {
        toast.error(messageFor(result.code));
      }
      return;
    }

    toast.success(t("saved"));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
      {/* Two different pages behind one form.
          The manager runs the restaurant day to day: the general details, the
          opening hours, the delivery charges — theirs, and only theirs. What
          is left for the owner is what outlives a shift: the home-page
          gallery, the legal texts, and the receipt paper the printer holds. */}
      <Tabs defaultValue={isMaster ? "general" : "delivery"}>
        <TabsList className="mb-4 h-auto flex-wrap">
          {!isMaster && (
            <TabsTrigger value="delivery">{t("deliveryTab")}</TabsTrigger>
          )}
          {isMaster && (
            <>
              <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
              <TabsTrigger value="printing">{t("printingTab")}</TabsTrigger>
            </>
          )}
          {/* The hours and the home-page gallery belong to whoever is running
              the day: closing early on a quiet night, or swapping the photo of
              tonight's special, should not have to wait on the owner. */}
          <TabsTrigger value="hours">{t("hoursTab")}</TabsTrigger>
          <TabsTrigger value="hero">{t("heroTab")}</TabsTrigger>
          <TabsTrigger value="content">{t("contentTab")}</TabsTrigger>
        </TabsList>

        {isMaster && (
          <TabsContent value="printing">
            <Card className="p-5">
              <FieldGroup>
                <Field data-invalid={!!errors.receiptWidthMm}>
                  <FieldLabel htmlFor="set-paper">
                    {t("receiptWidth")}
                  </FieldLabel>
                  <select
                    id="set-paper"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    {...register("receiptWidthMm")}
                  >
                    <option value={58}>{t("receiptWidth58")}</option>
                    <option value={80}>{t("receiptWidth80")}</option>
                  </select>
                  <FieldDescription>{t("receiptWidthHint")}</FieldDescription>
                  <FieldError errors={[errors.receiptWidthMm]} />
                </Field>

                <Field data-invalid={!!errors.salesUrl}>
                  <FieldLabel htmlFor="set-sales-url">
                    {t("salesUrl")}
                  </FieldLabel>
                  <Input
                    id="set-sales-url"
                    dir="ltr"
                    inputMode="url"
                    placeholder="https://…"
                    {...register("salesUrl")}
                  />
                  <FieldDescription>{t("salesUrlHint")}</FieldDescription>
                  <FieldError errors={[errors.salesUrl]} />
                </Field>
              </FieldGroup>
            </Card>
          </TabsContent>
        )}

        {isMaster && (
          <TabsContent value="general">
            <Card className="p-5">
              <FieldGroup>
                {/* Restaurant name — one field. It writes the German column
                    and mirrors into the retained Arabic one, so every reader
                    (footer, header, receipts) stays bilingual. */}
                <Field data-invalid={!!errors.restaurantNameDe}>
                  <FieldLabel htmlFor="set-name">
                    {t("restaurantName")}
                  </FieldLabel>
                  <Input
                    id="set-name"
                    {...register("restaurantNameDe", {
                      onChange: (event) =>
                        setValue("restaurantNameAr", event.target.value),
                    })}
                  />
                  <FieldError errors={[errors.restaurantNameDe]} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={!!errors.phone}>
                    <FieldLabel htmlFor="set-phone">{t("phone")}</FieldLabel>
                    <Input id="set-phone" dir="ltr" {...register("phone")} />
                    <FieldError errors={[errors.phone]} />
                  </Field>

                  <Field data-invalid={!!errors.email}>
                    <FieldLabel htmlFor="set-email">{t("email")}</FieldLabel>
                    <Input
                      id="set-email"
                      type="email"
                      dir="ltr"
                      {...register("email")}
                    />
                    <FieldError errors={[errors.email]} />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="set-map">
                      {t("mapEmbedUrl")}
                    </FieldLabel>
                    <Input
                      id="set-map"
                      dir="ltr"
                      {...register("mapEmbedUrl")}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="set-fb">{t("facebookUrl")}</FieldLabel>
                    <Input id="set-fb" dir="ltr" {...register("facebookUrl")} />
                  </Field>
                </div>

                {/* Top-bar strip — one field. Non-empty text is what switches
                    the strip on now that the separate toggle is gone (the save
                    action derives the flag from it); the value also mirrors into
                    the Arabic column. */}
                <Field>
                  <FieldLabel htmlFor="set-promo">{t("promoText")}</FieldLabel>
                  <Input
                    id="set-promo"
                    {...register("promoBannerDe", {
                      onChange: (event) =>
                        setValue("promoBannerAr", event.target.value),
                    })}
                  />
                </Field>

                {/* PayPal at checkout — the owner's call, since with no
                    provider wired an ONLINE order records as unpaid. Off hides
                    PayPal and leaves cash on delivery as the only option. */}
                <Controller
                  control={control}
                  name="isPaypalEnabled"
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor="set-paypal">
                          {t("paypalEnabled")}
                        </FieldLabel>
                        <FieldDescription>
                          {t("paypalEnabledHint")}
                        </FieldDescription>
                      </div>
                      <Switch
                        id="set-paypal"
                        checked={Boolean(field.value)}
                        onCheckedChange={(checked) => field.onChange(checked)}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
            </Card>
          </TabsContent>
        )}

        {!isMaster && (
          <TabsContent value="delivery">
            <Card className="p-5">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={!!errors.minOrderValue}>
                    <FieldLabel htmlFor="set-min">
                      {t("minOrderValue")}
                    </FieldLabel>
                    <Input
                      id="set-min"
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      {...register("minOrderValue")}
                    />
                    <FieldError errors={[errors.minOrderValue]} />
                  </Field>

                  <Field data-invalid={!!errors.deliveryFee}>
                    <FieldLabel htmlFor="set-fee">
                      {t("deliveryFee")}
                    </FieldLabel>
                    <Input
                      id="set-fee"
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      {...register("deliveryFee")}
                    />
                    <FieldError errors={[errors.deliveryFee]} />
                  </Field>
                </div>
              </FieldGroup>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="hours" className="flex flex-col gap-4">
          {/* The manual override, above the schedule it overrides.
              A switch alone states the setting but not its consequence, and the
              consequence here is whether the shop is taking money right now —
              so the state is spelled out in a badge that is green for open and
              red for closed. Colour is not the only signal: the word changes
              too, which is what makes it readable to someone who cannot
              distinguish the two. */}
          <Controller
            control={control}
            name="isOpen"
            render={({ field }) => {
              const open = Boolean(field.value);

              return (
                <Card className="flex-row items-center justify-between gap-4 p-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{t("manualStatus")}</span>
                    <span className="text-sm text-muted-foreground">
                      {t("manualStatusHint")}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-bold text-white transition-colors",
                        open ? "bg-emerald-600" : "bg-rose-600",
                      )}
                    >
                      {open ? tStatus("open") : tStatus("closed")}
                    </span>
                    <Switch
                      checked={open}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      aria-label={t("manualStatus")}
                    />
                  </div>
                </Card>
              );
            }}
          />

          <Card className="gap-0 overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {WEEKDAYS.map((day, index) => (
                <li
                  key={day}
                  className="grid grid-cols-2 items-center gap-3 p-4 sm:grid-cols-[10rem_1fr_1fr_auto]"
                >
                  <span className="font-semibold">{tHours(day)}</span>

                  <input
                    type="hidden"
                    value={day}
                    {...register(`openingHours.${index}.day` as const)}
                  />

                  <Field>
                    <FieldLabel
                      htmlFor={`open-${day}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t("openTime")}
                    </FieldLabel>
                    <Input
                      id={`open-${day}`}
                      type="time"
                      dir="ltr"
                      {...register(`openingHours.${index}.open` as const)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor={`close-${day}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t("closeTime")}
                    </FieldLabel>
                    <Input
                      id={`close-${day}`}
                      type="time"
                      dir="ltr"
                      {...register(`openingHours.${index}.close` as const)}
                    />
                  </Field>

                  <Controller
                    control={control}
                    name={`openingHours.${index}.isClosed` as const}
                    render={({ field }) => {
                      const closed = Boolean(field.value);

                      return (
                        <Field
                          orientation="horizontal"
                          className="justify-end gap-2"
                        >
                          {/* The label states the row's actual state rather
                              than naming the setting. It used to read
                              "Geschlossen" on every row whether the day was
                              open or shut, which said nothing — the only
                              signal was the switch position, and a column of
                              identical words beside it invited misreading. */}
                          <FieldLabel
                            htmlFor={`closed-${day}`}
                            className={cn(
                              "text-xs font-semibold",
                              closed ? "text-rose-500" : "text-emerald-500",
                            )}
                          >
                            {closed ? t("dayClosed") : t("dayOpen")}
                          </FieldLabel>
                          {/* On means open, matching the manual status toggle
                              at the top of this tab. A switch that had to be
                              turned *on* to close the shop read backwards. */}
                          <Switch
                            id={`closed-${day}`}
                            checked={!closed}
                            onCheckedChange={(isOpen) =>
                              field.onChange(!isOpen)
                            }
                          />
                        </Field>
                      );
                    }}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="hero">
          <Card className="gap-4 p-5">
            <h2 className="text-base font-bold">{t("heroImagesTitle")}</h2>
            <Controller
              control={control}
              name="heroImages"
              render={({ field }) => (
                <HeroImagesField
                  value={(field.value as string[]) ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card className="p-5">
            <FieldGroup>
              {/* Each legal text is a single field: it writes the German
                  column the public pages render and mirrors into the retained
                  Arabic one, so the DB stays bilingual without a second input. */}
              <Field>
                <FieldLabel htmlFor="terms-de">{t("terms")}</FieldLabel>
                <Textarea
                  id="terms-de"
                  rows={10}
                  dir="ltr"
                  {...register("termsDe", {
                    onChange: (event) =>
                      setValue("termsAr", event.target.value),
                  })}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="privacy-de">{t("privacy")}</FieldLabel>
                <Textarea
                  id="privacy-de"
                  rows={8}
                  dir="ltr"
                  {...register("privacyDe", {
                    onChange: (event) =>
                      setValue("privacyAr", event.target.value),
                  })}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="allergens-de">{t("allergens")}</FieldLabel>
                <Textarea
                  id="allergens-de"
                  rows={8}
                  dir="ltr"
                  {...register("allergensDe", {
                    onChange: (event) =>
                      setValue("allergensAr", event.target.value),
                  })}
                />
              </Field>
            </FieldGroup>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 z-20 mt-6 border-t border-border bg-background/90 py-3 backdrop-blur-md">
        <Button
          type="submit"
          size="lg"
          className="rounded-lg font-bold"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner /> : <Save data-icon="inline-start" />}
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
