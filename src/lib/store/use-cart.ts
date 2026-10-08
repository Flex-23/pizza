"use client";

import { useSyncExternalStore } from "react";

import { cartTotals, useCartStore, type CartLine } from "@/lib/store/cart";

const EMPTY_LINES: CartLine[] = [];

/**
 * True once the persisted cart has been read back from localStorage.
 *
 * Subscribing to zustand's hydration event (rather than flipping a flag in an
 * effect) keeps the server render and the first client render identical, which
 * is what prevents a hydration mismatch on the cart badge.
 */
function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}

/** Reads the persisted cart safely, with totals derived on the fly. */
export function useCart() {
  const hydrated = useCartHydrated();
  const storedLines = useCartStore((state) => state.lines);

  const lines = hydrated ? storedLines : EMPTY_LINES;

  return {
    hydrated,
    lines,
    ...cartTotals(lines),
  };
}

export function useCartActions() {
  return {
    addItem: useCartStore((state) => state.addItem),
    decrement: useCartStore((state) => state.decrement),
    setQuantity: useCartStore((state) => state.setQuantity),
    removeItem: useCartStore((state) => state.removeItem),
    clear: useCartStore((state) => state.clear),
    reconcile: useCartStore((state) => state.reconcile),
  };
}

/**
 * How many of one dish are in the cart, counting every note variant of it.
 *
 * The card shows one number per dish, not one per request: someone who added a
 * plain pizza and a second one without onions has two pizzas in their cart, and
 * a card reading "1" beside them would look broken. The +/− controls act on a
 * single line (see `useLineKey`); this is only what the customer is told.
 */
export function useLineQuantity(menuItemId: string): number {
  const hydrated = useCartHydrated();
  const quantity = useCartStore((state) =>
    state.lines.reduce(
      (total, line) =>
        line.menuItemId === menuItemId ? total + line.quantity : total,
      0,
    ),
  );

  return hydrated ? quantity : 0;
}
