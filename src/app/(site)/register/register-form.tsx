"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  Check,
  Home,
  Lock,
  MapPin,
  PartyPopper,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { registerAction } from "@/app/actions/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { useActionResult } from "@/lib/actions/use-action-result";
import { findStreet } from "@/lib/data/streets";
import { registerSchema, type RegisterInput } from "@/lib/schemas/auth";
import { cn } from "@/lib/utils";

import { StreetCombobox } from "@/components/address/street-combobox";

/** Every field on this form is mandatory, so each label carries this marker. */
function Required() {
  const t = useTranslations("auth");

  return (
    <span className="text-destructive" title={t("requiredField")}>
      *<span className="sr-only">{t("requiredField")}</span>
    </span>
  );
}

/** A numbered heading for one of the form's three sections. */
function SectionLegend({
  step,
  icon,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <FieldLegend className="mb-0 flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {step}/3
      </span>
    </FieldLegend>
  );
}

/** A read-only, auto-filled address field (postal code, city, district). */
function AutoField({ label, value }: { label: string; value: string }) {
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
    </div>
  );
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const tCheckout = useTranslations("checkout");
  const router = useRouter();
  const { messageFor, applyFieldErrors } = useActionResult<RegisterInput>();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      streetName: "",
      houseNumber: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Selecting a street resolves the rest of the address from the dataset; these
  // three fields are shown read-only so a customer can never introduce a
  // mismatch between street and postal code / city / district.
  const streetName = useWatch({ control, name: "streetName" });
  const selected = findStreet(streetName ?? "");

  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  /**
   * The new customer's name, held only to greet them in the success dialog —
   * and doubling as the flag that opens it. Navigation waits for them to
   * acknowledge the dialog: pushing straight to the home page would unmount it
   * before it had been read.
   */
  const [registeredName, setRegisteredName] = useState<string | null>(null);

  async function onSubmit(values: RegisterInput) {
    const result = await registerAction(values);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);
      if (result.code === "EMAIL_TAKEN") {
        setError("email", { type: "server", message: t("emailTaken") });
      } else if (!handled) {
        toast.error(messageFor(result.code));
      }
      return;
    }

    setRegisteredName(values.name);
  }

  /**
   * Leaves for the home page — the account already exists and is signed in, so
   * `refresh` is what makes the header show the new customer rather than the
   * signed-out state the page was rendered with.
   */
  function goHome() {
    setRegisteredName(null);
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
      <FieldGroup className="gap-7">
        {/* Personal information ------------------------------------------- */}
        <FieldSet>
          <SectionLegend step={1} icon={<UserPlus />}>
            {t("personalSection")}
          </SectionLegend>

          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="reg-name">
              {t("name")} <Required />
            </FieldLabel>
            <Input
              id="reg-name"
              className="h-11"
              autoComplete="name"
              required
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="reg-email">
              {t("email")} <Required />
            </FieldLabel>
            <Input
              id="reg-email"
              type="email"
              dir="ltr"
              className="h-11"
              autoComplete="username"
              required
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="reg-phone">
              {t("phone")} <Required />
            </FieldLabel>
            <Input
              id="reg-phone"
              type="tel"
              dir="ltr"
              className="h-11"
              autoComplete="tel"
              required
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
            <FieldError errors={[errors.phone]} />
          </Field>
        </FieldSet>

        {/* Delivery address ---------------------------------------------- */}
        <FieldSet>
          <SectionLegend step={2} icon={<MapPin />}>
            {t("addressSection")}
          </SectionLegend>
          <FieldDescription className="-mt-2">
            {t("addressHint")}
          </FieldDescription>

          <Field data-invalid={!!errors.streetName}>
            <FieldLabel htmlFor="reg-street">
              {t("streetName")} <Required />
            </FieldLabel>
            {/* Registered so validation tracks it, but driven by the combobox. */}
            <input type="hidden" {...register("streetName")} />
            <StreetCombobox
              id="reg-street"
              value={streetName ?? ""}
              onValueChange={(next) =>
                setValue("streetName", next, { shouldValidate: false })
              }
              onBlur={() => trigger("streetName")}
              invalid={!!errors.streetName}
              placeholder={t("streetNamePlaceholder")}
              noResultsLabel={t("streetNoResults")}
              aria-describedby="reg-street-hint"
            />
            <FieldDescription id="reg-street-hint">
              {t("streetSearchHint")}
            </FieldDescription>
            <FieldError errors={[errors.streetName]} />
          </Field>

          <Field data-invalid={!!errors.houseNumber}>
            <FieldLabel htmlFor="reg-house">
              {t("houseNumber")} <Required />
            </FieldLabel>
            <Input
              id="reg-house"
              className="h-11"
              inputMode="numeric"
              autoComplete="off"
              required
              aria-invalid={!!errors.houseNumber}
              {...register("houseNumber")}
            />
            <FieldError errors={[errors.houseNumber]} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AutoField
              label={tCheckout("postalCode")}
              value={selected?.postalCode ?? ""}
            />
            <AutoField label={tCheckout("city")} value={selected?.city ?? ""} />
            <AutoField label={t("district")} value={selected?.district ?? ""} />
          </div>
          <FieldDescription>{t("autoFilledNote")}</FieldDescription>
        </FieldSet>

        {/* Security ------------------------------------------------------ */}
        <FieldSet>
          <SectionLegend step={3} icon={<Lock />}>
            {t("securitySection")}
          </SectionLegend>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="reg-password">
              {t("password")} <Required />
            </FieldLabel>
            <PasswordInput
              id="reg-password"
              dir="ltr"
              className="h-11"
              autoComplete="new-password"
              required
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword || passwordsMismatch}>
            <FieldLabel htmlFor="reg-confirm">
              {t("confirmPassword")} <Required />
            </FieldLabel>
            <PasswordInput
              id="reg-confirm"
              dir="ltr"
              className="h-11"
              autoComplete="new-password"
              required
              aria-invalid={!!errors.confirmPassword || passwordsMismatch}
              {...register("confirmPassword")}
            />
            {/* Real-time match feedback, shown before submit. */}
            {passwordsMatch && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500">
                <Check className="size-4" />
                {t("passwordsMatch")}
              </p>
            )}
            {passwordsMismatch && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <X className="size-4" />
                {t("passwordsNoMatch")}
              </p>
            )}
            {!passwordsMismatch && (
              <FieldError errors={[errors.confirmPassword]} />
            )}
          </Field>
        </FieldSet>

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-lg text-base font-bold"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner /> : <Home data-icon="inline-start" />}
          {t("registerButton")}
        </Button>
      </FieldGroup>

      {/* Confirmation of a finished sign-up. Dismissing it by any route — the
          button, Escape, a click outside — goes to the home page, because the
          account exists either way and leaving the customer on a filled-in
          form would suggest it did not. */}
      <AlertDialog
        open={registeredName !== null}
        onOpenChange={(open) => {
          if (!open) goHome();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-success/12 text-success">
              <PartyPopper aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("accountCreatedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("accountCreatedBody", { name: registeredName ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={goHome} className="w-full sm:w-auto">
              {t("accountCreatedContinue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
