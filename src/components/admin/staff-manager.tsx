"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { Crown, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import {
  createManagerAction,
  deleteStaffAction,
  setUserRoleAction,
} from "@/app/actions/admin/staff";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Badge } from "@/components/ui/badge";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { useActionResult } from "@/lib/actions/use-action-result";
import type { UserRole } from "@/lib/auth/roles";
import {
  managerCreateSchema,
  type ManagerCreateInput,
} from "@/lib/schemas/auth";
import { cn } from "@/lib/utils";

export type StaffView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
};

/** The colour each role wears — on its chip and behind its icon. */
const ROLE_STYLE: Record<UserRole, string> = {
  MASTER: "border-primary/25 bg-primary/10 text-primary",
  ADMIN: "border-sale/30 bg-sale/10 text-sale",
  CUSTOMER: "border-border bg-muted text-muted-foreground",
};

const ROLE_ICON: Record<UserRole, React.ElementType> = {
  MASTER: Crown,
  ADMIN: ShieldCheck,
  CUSTOMER: Users,
};

/**
 * The owner's page for the people who run the dashboard.
 *
 * A manager is made here, from an address and a password, and removed here —
 * customers are not part of it: a shop account is not a step on the way to
 * staff, and the two lists have nothing to do with each other.
 */
export function StaffManager({
  users,
  currentUserId,
}: {
  users: StaffView[];
  currentUserId: string;
}) {
  const t = useTranslations("admin.staff");

  return (
    <div className="flex flex-col gap-6">
      <NewManagerCard />

      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-muted/40 px-4 py-3">
          <Users className="size-5 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-bold">{t("staffTitle")}</h2>
          <Badge variant="outline" className="font-semibold tabular-nums">
            {users.length}
          </Badge>
        </div>

        {users.length === 0 ? (
          <p className="px-4 py-10 text-center text-base text-muted-foreground">
            {t("noStaff")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((entry) => (
              <StaffRow
                key={entry.id}
                user={entry}
                isSelf={entry.id === currentUserId}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Two fields and a button: the whole of appointing a manager. */
function NewManagerCard() {
  const t = useTranslations("admin.staff");
  const tAuth = useTranslations("auth");
  const { messageFor, applyFieldErrors } =
    useActionResult<ManagerCreateInput>();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ManagerCreateInput>({
    resolver: zodResolver(managerCreateSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: ManagerCreateInput) {
    const result = await createManagerAction(values);

    if (!result.ok) {
      const handled = applyFieldErrors(result, setError);

      if (result.code === "EMAIL_TAKEN") {
        setError("email", { type: "server", message: t("emailTaken") });
        return;
      }
      if (!handled) toast.error(messageFor(result.code));
      return;
    }

    toast.success(t("managerCreated"));
    reset();
    router.refresh();
  }

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-muted/40 px-4 py-3">
        <UserPlus className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-bold">{t("newManager")}</h2>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        method="post"
        noValidate
        className="p-4"
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="mgr-email">{tAuth("email")}</FieldLabel>
              <Input
                id="mgr-email"
                type="email"
                dir="ltr"
                autoComplete="off"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="mgr-password">
                {tAuth("password")}
              </FieldLabel>
              <PasswordInput
                id="mgr-password"
                dir="ltr"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <FieldError errors={[errors.password]} />
            </Field>
          </div>

          <FieldDescription>{t("newManagerHint")}</FieldDescription>

          <Button
            type="submit"
            className="w-fit rounded-lg font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : <UserPlus data-icon="inline-start" />}
            {t("createManager")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

/** One staff account: what it may open, and the two ways to change that. */
function StaffRow({ user, isSelf }: { user: StaffView; isSelf: boolean }) {
  const t = useTranslations("admin.staff");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const { messageFor } = useActionResult();
  const [isPending, startTransition] = useTransition();

  const Icon = ROLE_ICON[user.role];
  const style = ROLE_STYLE[user.role];

  /** The role this account can be moved to — there are only two to swap. */
  const otherRole: UserRole = user.role === "ADMIN" ? "MASTER" : "ADMIN";

  function changeRole() {
    startTransition(async () => {
      const result = await setUserRoleAction({ id: user.id, role: otherRole });

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }

      toast.success(t("roleUpdated", { name: user.name }));
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteStaffAction(user.id);

      if (!result.ok) {
        toast.error(messageFor(result.code));
        return;
      }

      toast.success(t("deleted", { name: user.name }));
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          style,
        )}
        aria-hidden
      >
        <Icon className="size-4.5" />
      </span>

      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{user.name}</span>
          <Badge
            variant="outline"
            className={cn("h-6 text-sm font-semibold", style)}
          >
            {t(`role.${user.role}`)}
          </Badge>
          {isSelf && (
            <Badge variant="outline" className="h-6 text-sm">
              {t("you")}
            </Badge>
          )}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          <bdi dir="ltr">{user.email}</bdi>
        </span>
      </div>

      <span className="shrink-0 text-sm text-muted-foreground">
        {format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}
      </span>

      {/* The owner cannot restyle or remove their own access from here: the
          page they are standing on would vanish under them. */}
      {isSelf ? (
        <span className="shrink-0 text-sm text-muted-foreground">
          {t("selfLocked")}
        </span>
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isPending && <Spinner className="size-4" />}

          <ConfirmDialog
            title={t("confirm", {
              name: user.name,
              role: t(`role.${otherRole}`),
            })}
            confirmLabel={t(`action.${otherRole}`)}
            cancelLabel={tCommon("cancel")}
            onConfirm={changeRole}
            trigger={
              <Button size="sm" variant="outline" disabled={isPending}>
                {t(`action.${otherRole}`)}
              </Button>
            }
          />

          <ConfirmDialog
            title={t("deleteConfirm", { name: user.name })}
            confirmLabel={tCommon("delete")}
            cancelLabel={tCommon("cancel")}
            onConfirm={remove}
            trigger={
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 data-icon="inline-start" />
                {t("deleteManager")}
              </Button>
            }
          />
        </div>
      )}
    </li>
  );
}
