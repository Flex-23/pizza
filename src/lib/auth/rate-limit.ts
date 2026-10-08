import "server-only";

/**
 * Small in-process attempt limiter for the login form.
 *
 * The dashboard lives behind the same `loginAction` as the customer login, so
 * without this an attacker can try passwords as fast as the CPU hashes them.
 * State is per Node process and resets on restart, which is the right trade-off
 * for a single-server deployment; a multi-instance setup would need Redis or a
 * database table instead.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing forever on a long-running server. */
function sweep(now: number): void {
  if (buckets.size < 500) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type AttemptVerdict = { allowed: boolean; retryAfterSeconds: number };

/** Records one attempt and reports whether it may proceed. */
export function consumeAttempt(
  key: string,
  limit: number,
  windowMs: number,
): AttemptVerdict {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Called after a successful sign-in so a legitimate user starts fresh. */
export function clearAttempts(key: string): void {
  buckets.delete(key);
}
