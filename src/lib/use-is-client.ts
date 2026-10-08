"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` during the server render and the first client render, `true`
 * afterwards.
 *
 * Preferred over the `useState` + `useEffect` "mounted" pattern: it reports the
 * change through React's own store subscription instead of triggering a
 * cascading re-render from inside an effect.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
