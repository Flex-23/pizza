/**
 * Guards `?next=` style redirects.
 *
 * A leading slash is not enough: "//evil.com" and "/\evil.com" are
 * protocol-relative, so a browser reads them as another site and the login page
 * becomes an open redirect. Only a single-slash path stays on this origin.
 */
export function isSafeRedirectPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !/^\/[/\\]/.test(value)
  );
}

/** The requested path when it is safe, otherwise the fallback. */
export function safeRedirectPath(value: unknown, fallback: string): string {
  return isSafeRedirectPath(value) ? value : fallback;
}
