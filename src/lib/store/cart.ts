"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { round2 } from "@/lib/money";
import type { MenuItemView } from "@/lib/schemas/menu-item";

export type CartLine = {
  menuItemId: string;
  nameAr: string;
  nameDe: string;
  /** Price actually charged, after any discount. */
  unitPrice: number;
  /** List price before discount — kept so the cart can show the saving. */
  originalPrice: number;
  imageUrl: string | null;
  quantity: number;
  /** The customer's request for this dish, when it accepts one. */
  note?: string;
};

/**
 * What makes two lines the same line.
 *
 * A dish ordered plain and the same dish ordered "ohne Zwiebeln" are two
 * different things to the kitchen, so they cannot share a quantity — bumping
 * one would silently rewrite the other's note. Keying on the dish *and* its note
 * splits them into their own lines, while two identical requests still merge as
 * before. A line with no note keys on the id alone, exactly as it always did,
 * so carts persisted before notes existed keep working untouched.
 */
export function lineKey(menuItemId: string, note?: string): string {
  return note ? `${menuItemId}::${note}` : menuItemId;
}

/** The key of an existing line. */
function keyOf(line: CartLine): string {
  return lineKey(line.menuItemId, line.note);
}

type CartState = {
  lines: CartLine[];
  addItem: (item: MenuItemView, quantity?: number, note?: string) => void;
  decrement: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  /** Drops lines whose ids are no longer on the menu and refreshes prices. */
  reconcile: (available: MenuItemView[]) => { removed: RemovedLine[] };
};

/** Both names travel back, so the notice can be shown in the active language. */
export type RemovedLine = { nameAr: string; nameDe: string };

const MAX_QUANTITY = 99;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      addItem: (item, quantity = 1, note) =>
        set((state) => {
          // A dish that does not accept notes can never carry one, whatever the
          // caller passes: the flag is the menu's rule, not the card's.
          const cleanNote = item.allowCustomNote
            ? note?.trim() || undefined
            : undefined;
          const key = lineKey(item.id, cleanNote);
          const existing = state.lines.find((line) => keyOf(line) === key);

          if (existing) {
            return {
              lines: state.lines.map((line) =>
                keyOf(line) === key
                  ? {
                      ...line,
                      quantity: Math.min(
                        line.quantity + quantity,
                        MAX_QUANTITY,
                      ),
                      // Re-snapshot in case the price changed since it was added.
                      unitPrice: item.finalPrice,
                      originalPrice: item.price,
                    }
                  : line,
              ),
            };
          }

          return {
            lines: [
              ...state.lines,
              {
                menuItemId: item.id,
                nameAr: item.nameAr,
                nameDe: item.nameDe,
                unitPrice: item.finalPrice,
                originalPrice: item.price,
                imageUrl: item.imageUrl,
                quantity: Math.min(quantity, MAX_QUANTITY),
                ...(cleanNote ? { note: cleanNote } : {}),
              },
            ],
          };
        }),

      decrement: (key) =>
        set((state) => ({
          lines: state.lines
            .map((line) =>
              keyOf(line) === key
                ? { ...line, quantity: line.quantity - 1 }
                : line,
            )
            .filter((line) => line.quantity > 0),
        })),

      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((line) =>
              keyOf(line) === key
                ? {
                    ...line,
                    quantity: Math.max(0, Math.min(quantity, MAX_QUANTITY)),
                  }
                : line,
            )
            .filter((line) => line.quantity > 0),
        })),

      removeItem: (key) =>
        set((state) => ({
          lines: state.lines.filter((line) => keyOf(line) !== key),
        })),

      clear: () => set({ lines: [] }),

      reconcile: (available) => {
        const byId = new Map(available.map((item) => [item.id, item]));
        const removed: RemovedLine[] = [];

        set((state) => ({
          lines: state.lines.flatMap((line) => {
            const item = byId.get(line.menuItemId);

            if (!item || !item.isAvailable) {
              removed.push({ nameAr: line.nameAr, nameDe: line.nameDe });
              return [];
            }

            return [
              {
                ...line,
                nameAr: item.nameAr,
                nameDe: item.nameDe,
                unitPrice: item.finalPrice,
                originalPrice: item.price,
                imageUrl: item.imageUrl,
                // A note the dish no longer accepts is dropped here rather than
                // at checkout, so the cart shows what will actually be ordered.
                note: item.allowCustomNote ? line.note : undefined,
              },
            ];
          }),
        }));

        return { removed };
      },
    }),
    {
      // Still version 1, deliberately. Per-dish notes added an *optional* field:
      // a line persisted before they existed has no `note`, so `lineKey` returns
      // its bare id — the very key it had before — and every stored cart keeps
      // working untouched. Bumping the version would have thrown those carts
      // away for no gain.
      name: "pdn-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

/** Totals derived from the lines — never stored, so they cannot drift. */
export function cartTotals(lines: CartLine[]) {
  const subtotal = round2(
    lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0),
  );
  const listTotal = round2(
    lines.reduce(
      (total, line) => total + line.originalPrice * line.quantity,
      0,
    ),
  );
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);

  return {
    subtotal,
    listTotal,
    discountTotal: round2(Math.max(0, listTotal - subtotal)),
    itemCount,
  };
}
