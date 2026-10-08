"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, MapPin, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  findStreet,
  searchStreets,
  type StreetRecord,
} from "@/lib/data/streets";

type StreetComboboxProps = {
  id: string;
  /** The confirmed street name (a react-hook-form value). */
  value: string;
  /** Fires on every keystroke and on selection with the chosen street name. */
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  placeholder?: string;
  noResultsLabel: string;
  "aria-describedby"?: string;
};

/**
 * A searchable, strict-list street picker. The user must land on one of the
 * dataset's streets — free text that matches nothing is surfaced as "no
 * results" and left for the schema to reject. Built on a plain input plus a
 * listbox rather than a portalled popover so it behaves predictably in the RTL
 * card and keeps focus on the input while arrowing through options.
 */
export function StreetCombobox({
  id,
  value,
  onValueChange,
  onBlur,
  invalid,
  placeholder,
  noResultsLabel,
  "aria-describedby": describedBy,
}: StreetComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = open ? searchStreets(value, 8) : [];
  // A confirmed selection is one whose text exactly matches a dataset street.
  const isConfirmed = findStreet(value) !== undefined;

  // Close when focus leaves the whole widget (input + list).
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function choose(record: StreetRecord) {
    onValueChange(record.street);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      const record = results[activeIndex];
      if (record) choose(record);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          aria-invalid={invalid}
          aria-describedby={describedBy}
          autoComplete="off"
          className={cn("h-11 ps-8", isConfirmed && "pe-8")}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        {isConfirmed && (
          <Check
            className="pointer-events-none absolute inset-y-0 end-2.5 my-auto size-4 text-emerald-600 dark:text-emerald-500"
            aria-hidden
          />
        )}
      </div>

      {open && value.trim() !== "" && !isConfirmed && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg bg-popover p-1 text-sm shadow-md ring-1 ring-foreground/10"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">
              {noResultsLabel}
            </li>
          ) : (
            results.map((record, index) => (
              <li
                key={record.street}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // onMouseDown (not click) so the pick lands before the input's
                // blur can close the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(record);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
              >
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{record.street}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {record.district}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
