/**
 * Prisma reads `undefined` as "leave this column unchanged", so an optional
 * field the manager just emptied would silently keep its old value. Converting
 * those keys to `null` before the write makes clearing a field actually clear it.
 */
export function clearable<T extends Record<string, unknown>>(
  data: T,
  keys: ReadonlyArray<keyof T>,
): T {
  const result = { ...data };

  for (const key of keys) {
    if (result[key] === undefined) {
      result[key] = null as T[keyof T];
    }
  }

  return result;
}
