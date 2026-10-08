"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { managerLoginAction } from "@/app/actions/auth";
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
import { MANAGER_ROUTES } from "@/lib/admin-path";
import { useActionResult } from "@/lib/actions/use-action-result";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

export function ManagerLoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { messageFor, applyFieldErrors } = useActionResult<LoginInput>();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    // The action is the gate: it refuses anyone who is not ADMIN before any
    // session exists. The owner has their own page and a customer has the
    // shop's, and both are told only that the credentials are wrong.
    const result = await managerLoginAction(values);

    if (!result.ok) {
      applyFieldErrors(result, setError);
      toast.error(messageFor(result.code));
      return;
    }

    // Straight to the live queue — the screen a manager opens the shift on.
    router.replace(MANAGER_ROUTES.orders);
    router.refresh();
  }

  return (
    <Card className="p-6">
      {/*
       * React handles this submit and the method never comes into it. It is
       * here for the moment before hydration finishes — a slow phone, a chunk
       * that did not arrive, a manager pressing Enter a second too early. The
       * browser then submits the form itself, and without a method that is a
       * GET: the password lands in the address bar, in the history, and in the
       * server's log of the request. As a POST it stays in the body.
       */}
      <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="mgr-login-email">{t("email")}</FieldLabel>
            <Input
              id="mgr-login-email"
              type="email"
              autoComplete="username"
              dir="ltr"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="mgr-login-password">
              {t("password")}
            </FieldLabel>
            <PasswordInput
              id="mgr-login-password"
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
