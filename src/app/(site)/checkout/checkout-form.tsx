"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  CreditCard,
  MapPin,
  MapPinHouse,
  MapPinPlus,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { placeOrderAction } from "@/app/actions/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { StreetCombobox } from "@/components/address/street-combobox";
import { useActionResult } from "@/lib/actions/use-action-result";
import { findStreet } from "@/lib/data/streets";
import { formatPrice, round2 } from "@/lib/money";
import { pickLocalized } from "@/lib/localized";
import type { AddressView } from "@/lib/schemas/auth";
import {
  checkoutSchema,
  type CheckoutData,
  type CheckoutInput,
} from "@/lib/schemas/order";
import type { DeliveryZoneView } from "@/lib/schemas/settings";
import { lineKey } from "@/lib/store/cart";
import { useCart, useCartActions } from "@/lib/store/use-cart";
import { cn } from "@/lib/utils";

type CheckoutFormProps = {
  settings: {
    minOrderValue: number;
    deliveryFee: number;
    freeDeliveryFrom: number | null;
    city: string;
  };
  zones: DeliveryZoneView[];
  addresses: AddressView[];
  user: { name: string; email: string; phone: string } | null;
  canOrder: boolean;
  /** Whether the master has switched PayPal on; drives the checkout payment UI. */
  paypalEnabled: boolean;
};

/** Whose address this order goes to — the account's, or one just for tonight. */
type AddressMode = "saved" | "custom";

/**
 * The single question this section asks: how does the food get to the customer.
 *
 * It used to be two questions — delivery-or-pickup, and then, nested underneath
 * delivery, saved-or-other address — which made the second pair look like a
 * property of the first rather than the same decision continued. Flattened, the
 * three real outcomes sit side by side.
 *
 * `PICKUP` is the only one that sets `orderType` to PICKUP; the other two are
 * both deliveries that differ in *which* address, which is why this maps onto
 * the form's `orderType` plus `addressMode` rather than replacing them.
 */
type FulfilmentMode = "PICKUP" | "DELIVERY_SAVED" | "DELIVERY_NEW";

export function CheckoutForm({
  settings,
  zones,
  addresses,
  user,
  canOrder,
  paypalEnabled,
}: CheckoutFormProps) {
  const t = useTranslations("checkout");
  const tAccount = useTranslations("account");
  const tAuth = useTranslations("auth");
  const tCart = useTranslations("cart");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { messageFor, applyFieldErrors } = useActionResult<CheckoutInput>();

  const { lines, subtotal, discountTotal, hydrated } = useCart();
  const { clear } = useCartActions();

  const defaultAddress =
    addresses.find((entry) => entry.isDefault) ?? addresses[0];

  const form = useForm<CheckoutInput, unknown, CheckoutData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: user?.name ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      orderType: "DELIVERY",
      street: defaultAddress?.street ?? "",
      postalCode: defaultAddress?.postalCode ?? "",
      city: defaultAddress?.city ?? settings.city,
      notes: "",
      paymentMethod: "CASH_ON_DELIVERY",
      items: [],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  const orderType = useWatch({ control, name: "orderType" });
  const postalCode = useWatch({ control, name: "postalCode" });
  const [submitted, setSubmitted] = useState(false);

  /**
   * Where this order goes. A signed-in customer starts on the address their
   * account already holds — it is already in the form above — and can switch to
   * a one-off address for tonight. That second address lives on this order and
   * nowhere else: nothing on this page writes to the saved one, which stays
   * editable only from the account page.
   */
  const [addressMode, setAddressMode] = useState<AddressMode>(
    defaultAddress ? "saved" : "custom",
  );
  const [savedAddressId, setSavedAddressId] = useState(
    defaultAddress?.id ?? "",
  );
  const savedAddress =
    addresses.find((entry) => entry.id === savedAddressId) ?? defaultAddress;

  /**
   * A one-off address is entered the same way registration does it: the street
   * is picked from the dataset and its postcode / city / district come back with
   * it, so the browser never supplies a mismatched pair. Only the house number
   * is free text. These two pieces are local state; the derived `street`,
   * `postalCode` and `city` the schema wants are written into the form below.
   */
  const [customStreetName, setCustomStreetName] = useState("");
  const [customHouseNumber, setCustomHouseNumber] = useState("");
  const customStreet = findStreet(customStreetName);

  function applyCustomAddress(streetName: string, houseNumber: string) {
    const record = findStreet(streetName);
    const number = houseNumber.trim();
    setValue(
      "street",
      record ? `${record.street}${number ? ` ${number}` : ""}` : "",
    );
    setValue("postalCode", record?.postalCode ?? "");
    setValue("city", record?.city ?? "");
  }

  function selectSavedAddress(address: AddressView) {
    setAddressMode("saved");
    setSavedAddressId(address.id);
    setValue("orderType", "DELIVERY");
    setValue("street", address.street, { shouldValidate: true });
    setValue("postalCode", address.postalCode, { shouldValidate: true });
    setValue("city", address.city, { shouldValidate: true });
  }

  function startCustomAddress() {
    setAddressMode("custom");
    setValue("orderType", "DELIVERY");
    // Blank rather than pre-filled: this is a different place, and an edit on
    // top of the saved address reads as if it were changing that address.
    setCustomStreetName("");
    setCustomHouseNumber("");
    setValue("street", "");
    setValue("postalCode", "");
    setValue("city", "");
  }

  /**
   * Which of the three choices is currently selected, derived rather than
   * stored: `orderType` and `addressMode` already say it between them, and a
   * third piece of state holding the same fact could disagree with them.
   *
   * A guest has no saved address to deliver to, so for them delivery is always
   * the "new address" card — the saved one is not offered at all.
   */
  const fulfilment: FulfilmentMode =
    orderType === "PICKUP"
      ? "PICKUP"
      : addressMode === "saved" && savedAddress
        ? "DELIVERY_SAVED"
        : "DELIVERY_NEW";

  function selectPickup() {
    setValue("orderType", "PICKUP");
    // The address fields are irrelevant to a pickup and the schema skips them,
    // but leaving a stale zone verdict on screen would still be confusing.
    setValue("street", "");
    setValue("postalCode", "");
    setValue("city", "");
  }

  // The cart is the source of truth for line items; keep the payload in sync.
  useEffect(() => {
    setValue(
      "items",
      lines.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        note: line.note,
      })),
    );
  }, [lines, setValue]);

  const matchedZone = useMemo(
    () => zones.find((zone) => zone.postalCode === postalCode) ?? null,
    [zones, postalCode],
  );

  const isDelivery = orderType === "DELIVERY";

  /**
   * The zone verdict for whatever postcode the order currently carries — shown
   * beside the auto-filled postcode and inside the saved-address summary. It is
   * a function, not a stored element: both call sites are mounted at once (the
   * custom block only hides via CSS in saved mode), and reusing one element
   * instance across two live positions trips React's reconciler.
   */
  function renderZoneStatus() {
    if (!(zones.length > 0 && postalCode?.length === 5)) return null;

    return (
      <span
        className={cn(
          "text-xs font-medium",
          matchedZone ? "text-success" : "text-destructive",
        )}
      >
        {matchedZone
          ? matchedZone.areaName
          : t("zoneNotCovered", { code: postalCode })}
      </span>
    );
  }

  const deliveryFee = useMemo(() => {
    if (!isDelivery) return 0;
    if (
      settings.freeDeliveryFrom !== null &&
      subtotal >= settings.freeDeliveryFrom
    ) {
      return 0;
    }
    if (matchedZone && matchedZone.deliveryFee > 0)
      return matchedZone.deliveryFee;
    return settings.deliveryFee;
  }, [isDelivery, matchedZone, settings, subtotal]);

  const minOrder =
    isDelivery && matchedZone && matchedZone.minOrder > 0
      ? matchedZone.minOrder
      : settings.minOrderValue;

  const total = round2(subtotal + deliveryFee);
  const meetsMinimum = subtotal >= minOrder;

  async function onSubmit(values: CheckoutData) {
    if (lines.length === 0) return;

    const result = await placeOrderAction(values);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);

      if (result.code === "BELOW_MINIMUM" && result.meta?.amount) {
        toast.error(t("belowMinimum", { amount: String(result.meta.amount) }));
      } else if (result.code === "ZONE_NOT_COVERED") {
        toast.error(
          t("zoneNotCovered", { code: String(result.meta?.code ?? "") }),
        );
      } else if (result.code === "RESTAURANT_CLOSED") {
        toast.error(t("restaurantClosed"));
      } else if (!handled || result.code !== "VALIDATION") {
        toast.error(messageFor(result.code));
      }
      return;
    }

    setSubmitted(true);
    clear();
    router.push(`/confirmation/${result.data.orderNumber}`);
  }

  if (hydrated && lines.length === 0 && !submitted) {
    return (
      <Card className="items-center gap-3 border-dashed py-16 text-center">
        <ShoppingBag className="size-10 text-muted-foreground" aria-hidden />
        <p className="text-lg font-bold">{tCart("empty")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {tCart("emptyBody")}
        </p>
        <Button className="mt-1 rounded-full" render={<Link href="/menu" />}>
          {tCart("goToMenu")}
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          {!user && (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
              {t("loginPrompt")}{" "}
              <Link
                href="/login?next=/checkout"
                className="font-semibold text-primary hover:underline"
              >
                {t("loginLink")}
              </Link>
              <span className="mx-1.5 opacity-50">·</span>
              <span className="text-muted-foreground">{t("guestNote")}</span>
            </p>
          )}

          <Card className="p-5">
            <FieldSet>
              <FieldLegend variant="label">{t("customerSection")}</FieldLegend>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={!!errors.customerName}>
                    <FieldLabel htmlFor="co-name">{t("name")}</FieldLabel>
                    <Input
                      id="co-name"
                      autoComplete="name"
                      placeholder={t("namePlaceholder")}
                      aria-invalid={!!errors.customerName}
                      {...register("customerName")}
                    />
                    <FieldError errors={[errors.customerName]} />
                  </Field>

                  <Field data-invalid={!!errors.phone}>
                    <FieldLabel htmlFor="co-phone">{t("phone")}</FieldLabel>
                    <Input
                      id="co-phone"
                      type="tel"
                      dir="ltr"
                      autoComplete="tel"
                      placeholder={t("phonePlaceholder")}
                      aria-invalid={!!errors.phone}
                      {...register("phone")}
                    />
                    <FieldError errors={[errors.phone]} />
                  </Field>
                </div>

                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="co-email">
                    {t("email")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </FieldLabel>
                  <Input
                    id="co-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                    {...register("email")}
                  />
                  <FieldError errors={[errors.email]} />
                </Field>
              </FieldGroup>
            </FieldSet>
          </Card>

          <Card className="p-5">
            <FieldSet>
              <FieldLegend variant="label">{t("deliverySection")}</FieldLegend>
              <FieldGroup>
                {/* Set by the cards below rather than typed into, but still
                    registered so the value reaches the schema. */}
                <input type="hidden" {...register("orderType")} />

                {/* The three ways an order can be fulfilled, as one flat set of
                    choices. The saved-address card is offered to anyone with an
                    account — disabled with a reason before they have saved one,
                    since hiding it entirely reads as a missing feature. A guest
                    has no account to keep an address in, so they see two. */}
                <div
                  className={cn(
                    "grid gap-3 sm:grid-cols-2",
                    user && "lg:grid-cols-3",
                  )}
                >
                  <ChoiceCard
                    icon={<Store className="size-5" />}
                    label={t("pickup")}
                    isActive={fulfilment === "PICKUP"}
                    onSelect={selectPickup}
                  />
                  {user && (
                    <ChoiceCard
                      icon={<MapPinHouse className="size-5" />}
                      label={t("useSavedAddress")}
                      hint={savedAddress ? undefined : t("noSavedAddress")}
                      disabled={!savedAddress}
                      isActive={fulfilment === "DELIVERY_SAVED"}
                      onSelect={() =>
                        savedAddress && selectSavedAddress(savedAddress)
                      }
                    />
                  )}
                  <ChoiceCard
                    icon={
                      user ? (
                        <MapPinPlus className="size-5" />
                      ) : (
                        <MapPin className="size-5" />
                      )
                    }
                    label={user ? t("useOtherAddress") : t("delivery")}
                    isActive={fulfilment === "DELIVERY_NEW"}
                    onSelect={startCustomAddress}
                  />
                </div>

                {isDelivery ? (
                  <>
                    {user && (
                      <>
                        {fulfilment === "DELIVERY_SAVED" && savedAddress && (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
                              <MapPinHouse
                                className="mt-0.5 size-5 shrink-0 text-primary"
                                aria-hidden
                              />
                              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                                <span className="flex flex-wrap items-center gap-2 font-semibold">
                                  {savedAddress.label || savedAddress.street}
                                  {savedAddress.isDefault && (
                                    <Badge variant="secondary">
                                      {tAccount("defaultAddress")}
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-muted-foreground">
                                  {savedAddress.street} —{" "}
                                  <bdi dir="ltr">{savedAddress.postalCode}</bdi>{" "}
                                  {savedAddress.city}
                                </span>
                                {/* The zone check still has to be visible here:
                                    the postcode field it normally sits under is
                                    not on screen in this mode. */}
                                {renderZoneStatus()}
                              </div>
                            </div>

                            {addresses.length > 1 && (
                              <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold">
                                  {t("savedAddresses")}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {addresses.map((address) => (
                                    <button
                                      key={address.id}
                                      type="button"
                                      aria-pressed={
                                        address.id === savedAddress.id
                                      }
                                      onClick={() =>
                                        selectSavedAddress(address)
                                      }
                                      className={cn(
                                        "rounded-lg border px-3 py-2 text-start text-xs transition-colors",
                                        address.id === savedAddress.id
                                          ? "border-primary bg-primary/8 text-primary"
                                          : "border-border bg-card hover:border-primary hover:bg-muted",
                                      )}
                                    >
                                      <span className="block font-semibold">
                                        {address.label || address.street}
                                      </span>
                                      <span className="block text-muted-foreground">
                                        <bdi dir="ltr">
                                          {address.postalCode}
                                        </bdi>{" "}
                                        {address.city}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* The address fields are hidden in this mode, so
                                their errors would have nowhere to appear. */}
                            <FieldError
                              errors={[
                                errors.street,
                                errors.postalCode,
                                errors.city,
                              ]}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div
                      className={cn(
                        "flex flex-col gap-4",
                        fulfilment !== "DELIVERY_NEW" && "hidden",
                      )}
                    >
                      {/* The schema's fields are derived from the picker below,
                          so they ride along hidden rather than being typed. */}
                      <input type="hidden" {...register("street")} />
                      <input type="hidden" {...register("postalCode")} />
                      <input type="hidden" {...register("city")} />

                      <Field data-invalid={!!errors.street}>
                        <FieldLabel htmlFor="co-street">
                          {tAuth("streetName")}
                        </FieldLabel>
                        <StreetCombobox
                          id="co-street"
                          value={customStreetName}
                          onValueChange={(next) => {
                            setCustomStreetName(next);
                            applyCustomAddress(next, customHouseNumber);
                          }}
                          onBlur={() => trigger("street")}
                          invalid={!!errors.street}
                          placeholder={tAuth("streetNamePlaceholder")}
                          noResultsLabel={tAuth("streetNoResults")}
                          aria-describedby="co-street-hint"
                        />
                        <FieldDescription id="co-street-hint">
                          {tAuth("streetSearchHint")}
                        </FieldDescription>
                        <FieldError errors={[errors.street]} />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="co-house">
                          {tAuth("houseNumber")}
                        </FieldLabel>
                        <Input
                          id="co-house"
                          inputMode="numeric"
                          autoComplete="off"
                          value={customHouseNumber}
                          onChange={(event) => {
                            setCustomHouseNumber(event.target.value);
                            applyCustomAddress(
                              customStreetName,
                              event.target.value,
                            );
                          }}
                        />
                      </Field>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <AutoField
                          label={t("postalCode")}
                          value={customStreet?.postalCode ?? ""}
                        >
                          {renderZoneStatus()}
                        </AutoField>
                        <AutoField
                          label={t("city")}
                          value={customStreet?.city ?? ""}
                        />
                        <AutoField
                          label={tAuth("district")}
                          value={customStreet?.district ?? ""}
                        />
                      </div>
                      <FieldDescription>
                        {tAuth("autoFilledNote")}
                      </FieldDescription>
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg bg-success/12 px-3 py-2 text-sm font-medium text-success">
                    {t("pickupNote")}
                  </p>
                )}

                <Field>
                  <FieldLabel htmlFor="co-notes">{t("notes")}</FieldLabel>
                  {/* Deliberately no placeholder: the label already names the
                      field, and the worked example that used to sit here read
                      as a suggestion of what to ask for. */}
                  <Textarea
                    id="co-notes"
                    rows={3}
                    placeholder=""
                    {...register("notes")}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          </Card>

          <Card className="p-5">
            <FieldSet>
              <FieldLegend variant="label">{t("paymentSection")}</FieldLegend>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  /* Cash at the door is what almost every order uses and what
                     the form opens on. PayPal only appears once the master has
                     switched it on in the settings; while it is off it is hidden
                     entirely rather than shown disabled, so cash on delivery is
                     the sole choice. */
                  /* Two columns only when there are two cards. With PayPal off
                     a fixed two-column grid left cash sitting in the left half
                     with an empty right half beside it; one column lets the
                     single option fill the row. */
                  <div
                    className={cn(
                      "grid gap-3",
                      paypalEnabled && "sm:grid-cols-2",
                    )}
                  >
                    <ChoiceCard
                      icon={<Wallet className="size-5" />}
                      label={t("cashOnDelivery")}
                      isActive={field.value === "CASH_ON_DELIVERY"}
                      onSelect={() => field.onChange("CASH_ON_DELIVERY")}
                    />
                    {paypalEnabled && (
                      <ChoiceCard
                        icon={<CreditCard className="size-5" />}
                        label={t("paypal")}
                        isActive={field.value === "ONLINE"}
                        onSelect={() => field.onChange("ONLINE")}
                      />
                    )}
                  </div>
                )}
              />
            </FieldSet>
          </Card>
        </div>

        <Card className="h-fit gap-4 p-5 lg:sticky lg:top-20">
          <h2 className="text-base font-bold">{t("summarySection")}</h2>

          <ul className="flex flex-col gap-2 text-sm">
            {lines.map((line) => (
              <li
                key={lineKey(line.menuItemId, line.note)}
                className="flex items-center gap-2"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold tabular-nums">
                  {line.quantity}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {pickLocalized(locale, line.nameAr, line.nameDe)}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatPrice(round2(line.unitPrice * line.quantity), locale)}
                </span>
              </li>
            ))}
          </ul>

          <Separator />

          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{tCart("subtotal")}</dt>
              <dd className="tabular-nums">{formatPrice(subtotal, locale)}</dd>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between gap-4 text-sale">
                <dt>{tCart("discount")}</dt>
                <dd className="tabular-nums">
                  − {formatPrice(discountTotal, locale)}
                </dd>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{tCart("deliveryFee")}</dt>
              <dd className="tabular-nums">
                {formatPrice(deliveryFee, locale)}
              </dd>
            </div>

            <Separator className="my-1" />

            <div className="flex justify-between gap-4">
              <dt className="font-bold">{tCart("total")}</dt>
              <dd className="text-lg font-extrabold tabular-nums">
                {formatPrice(total, locale)}
              </dd>
            </div>
          </dl>

          {!meetsMinimum && (
            <p className="rounded-lg bg-warning/15 px-3 py-2 text-center text-xs font-semibold text-warning-foreground">
              {tCart("minOrderWarning", {
                amount: formatPrice(minOrder, locale),
                missing: formatPrice(round2(minOrder - subtotal), locale),
              })}
            </p>
          )}

          {!canOrder && (
            <p className="rounded-lg bg-destructive/12 px-3 py-2 text-center text-xs font-semibold text-destructive">
              {t("restaurantClosed")}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-full text-base font-bold"
            disabled={isSubmitting || !meetsMinimum || !canOrder}
          >
            {isSubmitting ? (
              <Spinner />
            ) : (
              <ShoppingBag data-icon="inline-start" />
            )}
            {isSubmitting ? t("placing") : t("placeOrder")}
          </Button>

          {errors.items && (
            <Badge
              variant="outline"
              className="justify-center text-destructive"
            >
              {tCart("empty")}
            </Badge>
          )}
        </Card>
      </div>
    </form>
  );
}

/**
 * A read-only, auto-filled address field (postcode, city, district) — resolved
 * from the picked street, so the customer can never introduce a mismatch. An
 * optional child (the zone verdict) sits beneath the value.
 */
function AutoField({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div
        className={cn(
          "flex h-11 items-center rounded-lg border border-dashed border-input bg-muted/40 px-2.5 text-sm transition-colors",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value || "—"}
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({
  icon,
  label,
  hint,
  isActive,
  disabled,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  isActive: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isActive}
      className={cn(
        // `justify-center` as well as `items-center`: the grid stretches every
        // card to the tallest one, so without it a one-line option sat pinned to
        // the top of a box sized for a three-line neighbour.
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-center transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isActive
          ? "border-primary bg-primary/8 text-primary"
          : "border-border bg-card hover:bg-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
      {hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </button>
  );
}
