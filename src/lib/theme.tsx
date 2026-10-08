"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

/**
 * A tiny theme provider — light / dark / follow-the-system — driven entirely by
 * the `dark` class on `<html>`. It replaces `next-themes`, whose no-flash helper
 * renders an inline `<script>` inside a client component; React 19 refuses to
 * run such a script on the client and logs a warning for it. Here the blocking
 * script (`THEME_SCRIPT`) is rendered once by the *server* layout instead, so
 * there is no flash and nothing warns, and the client side is only state.
 */

export type Theme = "light" | "dark" | "system";

/** Persisted choice and the class strategy — must match `THEME_SCRIPT` below. */
export const THEME_STORAGE_KEY = "pdn_theme";
const DEFAULT_THEME: Theme = "light";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before paint from the server-rendered layout, so the first frame is
 * already the right theme. Kept in sync with the provider by key and default.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||${JSON.stringify(DEFAULT_THEME)};var d=t==="dark"||(t==="system"&&matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Applies a choice to the `<html>` class — the store holds it, this reflects it. */
function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * The stored theme as an external store, read with `useSyncExternalStore`: it
 * reconciles the server default with the visitor's saved choice after hydration
 * without a setState-in-effect, and stays in sync across tabs.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Private-mode or blocked storage: fall back to the default.
  }
  return DEFAULT_THEME;
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

/**
 * Suppresses colour transitions for the instant a switch is applied, so the
 * whole page does not animate between palettes — the same trick next-themes'
 * `disableTransitionOnChange` used.
 */
function withoutTransitions(mutate: () => void): void {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode("*,*::before,*::after{transition:none !important}"),
  );
  document.head.appendChild(style);
  mutate();
  // Force a reflow so the "no transition" rule takes effect before removal.
  window.getComputedStyle(document.body).getPropertyValue("transition");
  document.head.removeChild(style);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Reflect the current choice on the DOM (covers a cross-tab change), and while
  // it is "system", follow the OS. DOM only — never setState — so this stays out
  // of the render/effect state loop.
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the class change below still applies.
    }
    withoutTransitions(() => applyTheme(next));
    for (const listener of listeners) listener();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
