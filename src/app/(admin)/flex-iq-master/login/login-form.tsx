"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { adminLoginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { MASTER_ROUTES } from "@/lib/admin-path";
import { useActionResult } from "@/lib/actions/use-action-result";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

export function AdminLoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { messageFor, applyFieldErrors } = useActionResult<LoginInput>();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: LoginInput) {
    // This door is the owner's, and the action is what enforces that — it
    // refuses anyone who is not MASTER before any session exists. A manager
    // signs in on the ordinary /login page and reaches the dashboard from the
    // link in the navbar.
    const result = await adminLoginAction(values);

    if (!result.ok) {
      applyFieldErrors(result, setError);
      toast.error(messageFor(result.code));
      return;
    }

    router.replace(MASTER_ROUTES.dashboard);
    router.refresh();
  }

  return (
    <Card className="p-6">
      {/* Keeps the password out of the URL if the form is submitted before
          React has hydrated — see the manager's login form. */}
      <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="admin-email">{t("email")}</FieldLabel>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              dir="ltr"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="admin-password">{t("password")}</FieldLabel>
            <PasswordInput
              id="admin-password"
              autoComplete="current-password"
              dir="ltr"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full rounded-lg font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : <LogIn data-icon="inline-start" />}
            {t("loginButton")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}
