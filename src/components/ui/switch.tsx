"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* The thumb travels along `inset-inline-start`, not `translate-x`.
          A physical X translation always pushes to the right — which in an
          Arabic page is the side the thumb already starts on, so switching on
          shoved it out of its own track instead of across it. The logical
          inset moves it to the far side in either direction, and animates the
          same way. The distances are the track's inner width (its border box
          less the 1px border) minus the thumb. */}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute inset-y-0 my-auto block rounded-full bg-background ring-0 transition-[inset-inline-start] duration-150 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:inset-s-[14px] group-data-[size=sm]/switch:data-checked:inset-s-[10px] dark:data-checked:bg-primary-foreground data-unchecked:inset-s-0 dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
