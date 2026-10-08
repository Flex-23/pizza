import type { z } from "zod";

/**
 * Server actions return an error *code*, never a sentence. The client maps the
 * code to a translated message, so error text stays in the message files and
 * works in both languages.
 */
export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "MASTER_WRONG_DOOR"
  | "ADMIN_WRONG_DOOR"
  | "EMAIL_TAKEN"
  | "WRONG_PASSWORD"
  | "SLUG_TAKEN"
  | "CATEGORY_HAS_ITEMS"
  | "RESTAURANT_CLOSED"
  | "BELOW_MINIMUM"
  | "ZONE_NOT_COVERED"
  | "PAYMENT_UNAVAILABLE"
  | "TOO_MANY_ATTEMPTS"
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_WRONG_TYPE"
  | "UPLOAD_FAILED"
  | "PRINT_FAILED"
  | "LAST_MASTER"
  | "SELF_ROLE"
  | "SERVER_ERROR";

export type ActionResult<TData = undefined> =
  | ({ ok: true } & (TData extends undefined
      ? { data?: undefined }
      : { data: TData }))
  | {
      ok: false;
      code: ActionErrorCode;
      /** Field-level messages from Zod, keyed by form field name. */
      fieldErrors?: Record<string, string[]>;
      /** Extra context for messages with placeholders, e.g. { amount: "10,00 €" }. */
      meta?: Record<string, string | number>;
    };

export function ok(): ActionResult;
export function ok<TData>(data: TData): ActionResult<TData>;
export function ok<TData>(data?: TData) {
  return { ok: true as const, data };
}

export function fail(
  code: ActionErrorCode,
  extra?: {
    fieldErrors?: Record<string, string[]>;
    meta?: Record<string, string | number>;
  },
): ActionResult<never> {
  return { ok: false, code, ...extra };
}

/** Turns a Zod failure into the field-error shape react-hook-form expects. */
export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fail("VALIDATION", { fieldErrors });
}
