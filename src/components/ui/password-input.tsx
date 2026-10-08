"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password field with a show/hide toggle.
 *
 * Everything a plain `<Input type="password">` accepts still works — it forwards
 * every prop and its ref, so `{...register("password")}` behaves exactly as it
 * did before. Only `type` is owned here, because that is the thing the button
 * flips.
 *
 * The eye sits inside the field, at the end of the line: `end-*` on the wrapper
 * rather than `right-*`, so it follows the page's writing direction and moves to
 * the left in Arabic.
 *
 * Keeping the text clear of it is the subtle part. Every call site sets
 * `dir="ltr"` on the input itself — a password is not prose — so a logical
 * `pe-10` on the input would resolve against *that* and always pad the right
 * edge, which is the wrong side once the page is RTL and the button has moved
 * left. The reserved space therefore lives on the wrapper, whose direction is
 * the page's, and is passed to the input as plain physical padding.
 */
function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = React.useState(false);

  const Icon = visible ? EyeOff : Eye;
  const label = visible ? t("hidePassword") : t("showPassword");

  return (
    <div className="relative flex w-full items-center">
      <Input
        type={visible ? "text" : "password"}
        disabled={disabled}
        // The reveal button overlays the end of the field; this keeps the value
        // from running underneath it. Physical sides, chosen by the *page's*
        // direction (the wrapper's), because the input's own dir is always ltr —
        // see the note above.
        className={cn("rtl:pl-10 ltr:pr-10", className)}
        {...props}
      />
      <button
        type="button"
        // Revealing is a view control, not a value: taking it out of the tab
        // order keeps Tab going straight from the password to the submit
        // button, and the label below still reaches a screen reader.
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setVisible((shown) => !shown)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className={cn(
          "absolute end-0 flex h-full w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors",
          "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export { PasswordInput };
