"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { useActionResult } from "@/lib/actions/use-action-result";
import { safeRedirectPath } from "@/lib/safe-path";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
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
    const result = await loginAction(values);

    if (!result.ok) {
      applyFieldErrors(result, setError);
      toast.error(messageFor(result.code));
      return;
    }

    // Home rather than the account page: signing in is almost always a step on
    // the way to ordering, and dropping the customer on their profile page
    // interrupted that. A `?next=` — set when the checkout sends a guest here to
    // sign in — still wins, so the interrupted flow resumes where it left off.
    //
    // Only same-origin paths are followed, so ?next= cannot be used to redirect
    // a signed-in customer to another site. "//evil.com" and "/\evil.com" also
    // start with a slash but are protocol-relative, i.e. off-site.
    const target = safeRedirectPath(redirectTo, "/");

    router.replace(target);
    router.refresh();
  }

  // `method` keeps the password out of the URL if the form is submitted before
  // React has hydrated — see the manager's login form for the whole story.
  return (
    <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="login-email">{t("email")}</FieldLabel>
          <Input
            id="login-email"
            type="email"
            dir="ltr"
            autoComplete="username"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="login-password">{t("password")}</FieldLabel>
          <PasswordInput
            id="login-password"
            dir="ltr"
            autoComplete="current-password"
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
  );
}
