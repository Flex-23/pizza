"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MapPin, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StreetCombobox } from "@/components/address/street-combobox";
import { findStreet, splitStreetAddress } from "@/lib/data/streets";
import { cn } from "@/lib/utils";

import {
  changePasswordAction,
  deleteAddressAction,
  saveAddressAction,
  updateAddressAction,
  updateProfileAction,
} from "@/app/actions/auth";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActionResult } from "@/lib/actions/use-action-result";
import {
  addressSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  type AddressInput,
  type AddressValues,
  type AddressView,
  type PasswordChangeInput,
  type ProfileUpdateInput,
} from "@/lib/schemas/auth";

type PasswordOutput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function AccountTabs({
  profile,
  addresses,
}: {
  profile: { name: string; email: string; phone: string };
  addresses: AddressView[];
}) {
  const t = useTranslations("account");

  // The one the account was opened with, unless another has been made default.
  const primaryAddress =
    addresses.find((entry) => entry.isDefault) ?? addresses[0] ?? null;

  return (
    <Tabs defaultValue="profile">
      <TabsList className="mb-4">
        <TabsTrigger value="profile">{t("profileTab")}</TabsTrigger>
        <TabsTrigger value="addresses">{t("addressesTab")}</TabsTrigger>
        <TabsTrigger value="password">{t("passwordTab")}</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="flex flex-col gap-4">
        <ProfileForm profile={profile} />
        <PrimaryAddressCard address={primaryAddress} />
      </TabsContent>

      <TabsContent value="addresses">
        <AddressesPanel addresses={addresses} />
      </TabsContent>

      <TabsContent value="password">
        <PasswordForm />
      </TabsContent>
    </Tabs>
  );
}

function ProfileForm({
  profile,
}: {
  profile: { name: string; email: string; phone: string };
}) {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { messageFor, applyFieldErrors } =
    useActionResult<ProfileUpdateInput>();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { name: profile.name, phone: profile.phone },
  });

  async function onSubmit(values: ProfileUpdateInput) {
    const result = await updateProfileAction(values);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);
      if (!handled) toast.error(messageFor(result.code));
      return;
    }

    toast.success(t("profileSaved"));
    router.refresh();
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="acc-email">{tAuth("email")}</FieldLabel>
            <Input id="acc-email" dir="ltr" value={profile.email} disabled />
          </Field>

          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="acc-name">{tAuth("name")}</FieldLabel>
            <Input
              id="acc-name"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="acc-phone">{tAuth("phone")}</FieldLabel>
            <Input
              id="acc-phone"
              type="tel"
              dir="ltr"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
            <FieldError errors={[errors.phone]} />
          </Field>

          <Button
            type="submit"
            className="w-fit rounded-lg font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : <Save data-icon="inline-start" />}
            {tCommon("save")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

/**
 * The address the account carries, read-only.
 *
 * It is what checkout offers first, so it belongs beside the name and phone
 * rather than only in a tab of its own — but it stays editable in one place,
 * the addresses tab, so there is never a second form claiming to own it.
 */
function PrimaryAddressCard({ address }: { address: AddressView | null }) {
  const t = useTranslations("account");

  return (
    <Card className="gap-3 p-5">
      <h2 className="text-base font-bold">{t("primaryAddress")}</h2>

      {address ? (
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {address.label || address.street}
              {address.isDefault && (
                <Badge variant="secondary">{t("defaultAddress")}</Badge>
              )}
            </span>
            <span className="text-sm text-muted-foreground">
              {address.street} — <bdi dir="ltr">{address.postalCode}</bdi>{" "}
              {address.city}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noAddresses")}</p>
      )}
    </Card>
  );
}

function PasswordForm() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const { messageFor, applyFieldErrors } =
    useActionResult<PasswordChangeInput>();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeInput, unknown, PasswordOutput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: PasswordOutput) {
    const result = await changePasswordAction(values);

    if (!result.ok) {
      if (result.code === "WRONG_PASSWORD") {
        setError("currentPassword", {
          type: "server",
          message: t("wrongPassword"),
        });
        return;
      }

      const handled = applyFieldErrors(result, setError);
      if (!handled) toast.error(messageFor(result.code));
      return;
    }

    toast.success(t("passwordChanged"));
    reset();
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.currentPassword}>
            <FieldLabel htmlFor="pw-current">{t("currentPassword")}</FieldLabel>
            <PasswordInput
              id="pw-current"
              dir="ltr"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              {...register("currentPassword")}
            />
            <FieldError errors={[errors.currentPassword]} />
          </Field>

          <Field data-invalid={!!errors.newPassword}>
            <FieldLabel htmlFor="pw-new">{t("newPassword")}</FieldLabel>
            <PasswordInput
              id="pw-new"
              dir="ltr"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
            <FieldError errors={[errors.newPassword]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="pw-confirm">
              {tAuth("confirmPassword")}
            </FieldLabel>
            <PasswordInput
              id="pw-confirm"
              dir="ltr"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>

          <Button
            type="submit"
            className="w-fit rounded-lg font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : <Save data-icon="inline-start" />}
            {tCommon("save")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

function AddressesPanel({ addresses }: { addresses: AddressView[] }) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { messageFor } = useActionResult();

  const [editing, setEditing] = useState<AddressView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleDelete(address: AddressView) {
    const result = await deleteAddressAction(address.id);

    if (!result.ok) {
      toast.error(messageFor(result.code));
      return;
    }

    toast.success(t("addressDeleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          className="rounded-full"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          {t("addAddress")}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-12 text-center">
          <MapPin className="size-9 text-muted-foreground" aria-hidden />
          <p className="font-bold">{t("noAddresses")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card className="flex-row items-center gap-3 p-4">
                <MapPin className="size-5 shrink-0 text-primary" aria-hidden />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-semibold">
                    {address.label || address.street}
                    {address.isDefault && (
                      <Badge variant="secondary">{t("defaultAddress")}</Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {address.street} —{" "}
                    <span dir="ltr">{address.postalCode}</span> {address.city}
                  </span>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tCommon("edit")}
                    onClick={() => {
                      setEditing(address);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>

                  <ConfirmDialog
                    title={t("deleteAddressConfirm")}
                    confirmLabel={tCommon("delete")}
                    cancelLabel={tCommon("cancel")}
                    onConfirm={() => handleDelete(address)}
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
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AddressDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        address={editing}
        onSaved={() => {
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function AddressDialog({
  open,
  onOpenChange,
  address,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: AddressView | null;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const tCheckout = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const { messageFor, applyFieldErrors } = useActionResult<AddressValues>();

  // An existing address stores "<street> <house number>" in one column; split
  // it so the combobox and the house-number field can prefill separately.
  const initial = splitStreetAddress(address?.street ?? "");

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<AddressValues, unknown, AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: address?.label ?? undefined,
      streetName: initial.streetName,
      houseNumber: initial.houseNumber,
      notes: address?.notes ?? undefined,
      isDefault: address?.isDefault ?? false,
    },
  });

  // Selecting a street resolves the rest of the address from the dataset; PLZ,
  // city and district are shown locked so they can never drift from the street.
  const streetName = useWatch({ control, name: "streetName" });
  const selected = findStreet(streetName ?? "");

  async function onSubmit(values: AddressInput) {
    const result = address
      ? await updateAddressAction({ id: address.id, data: values })
      : await saveAddressAction(values);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);
      if (!handled) toast.error(messageFor(result.code));
      return;
    }

    toast.success(t("addressSaved"));
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {address ? t("editAddress") : t("addAddress")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {address ? t("editAddress") : t("addAddress")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="addr-label">{t("addressLabel")}</FieldLabel>
              <Input
                id="addr-label"
                placeholder={t("addressLabelPlaceholder")}
                {...register("label")}
              />
            </Field>

            <Field data-invalid={!!errors.streetName}>
              <FieldLabel htmlFor="addr-street">
                {tAuth("streetName")}
              </FieldLabel>
              {/* Registered so validation tracks it, but driven by the combobox. */}
              <input type="hidden" {...register("streetName")} />
              <StreetCombobox
                id="addr-street"
                value={streetName ?? ""}
                onValueChange={(next) =>
                  setValue("streetName", next, { shouldValidate: false })
                }
                onBlur={() => trigger("streetName")}
                invalid={!!errors.streetName}
                placeholder={tAuth("streetNamePlaceholder")}
                noResultsLabel={tAuth("streetNoResults")}
              />
              <FieldError errors={[errors.streetName]} />
            </Field>

            <Field data-invalid={!!errors.houseNumber}>
              <FieldLabel htmlFor="addr-house">
                {tAuth("houseNumber")}
              </FieldLabel>
              <Input
                id="addr-house"
                inputMode="numeric"
                aria-invalid={!!errors.houseNumber}
                {...register("houseNumber")}
              />
              <FieldError errors={[errors.houseNumber]} />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AutoAddressField
                label={tCheckout("postalCode")}
                value={selected?.postalCode ?? ""}
              />
              <AutoAddressField
                label={tCheckout("city")}
                value={selected?.city ?? ""}
              />
              <AutoAddressField
                label={tAuth("district")}
                value={selected?.district ?? ""}
              />
            </div>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="addr-default">{t("setDefault")}</FieldLabel>
              <Switch
                id="addr-default"
                defaultChecked={address?.isDefault ?? false}
                onCheckedChange={(next) =>
                  setValue("isDefault", next, { shouldDirty: true })
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

/** A read-only, auto-filled address field (postal code, city, district). */
function AutoAddressField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div
        className={cn(
          "flex h-9 items-center rounded-lg border border-dashed border-input bg-muted/40 px-2.5 text-sm",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}
