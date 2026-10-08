"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { UseFormSetError, FieldValues, Path } from "react-hook-form";

import type { ActionErrorCode, ActionResult } from "@/lib/actions/result";

/**
 * Bridges a server action's error code back into the form.
 *
 * Field-level Zod messages land on the matching inputs; anything else becomes a
 * translated toast message the caller can show.
 */
export function useActionResult<TFieldValues extends FieldValues>() {
  const t = useTranslations("errors");

  const messageFor = useCallback((code: ActionErrorCode) => t(code), [t]);

  const applyFieldErrors = useCallback(
    (
      result: Extract<ActionResult<unknown>, { ok: false }>,
      setError: UseFormSetError<TFieldValues>,
    ) => {
      if (!result.fieldErrors) return false;

      let applied = false;

      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        const message = messages.find(Boolean);
        if (!message) continue;

        setError(field as Path<TFieldValues>, { type: "server", message });
        applied = true;
      }

      return applied;
    },
    [],
  );

  return { messageFor, applyFieldErrors };
}
