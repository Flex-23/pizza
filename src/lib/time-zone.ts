/**
 * The one clock the business runs on.
 *
 * Shifts, ticket numbers, reports and opening hours are all counted on
 * Karlsruhe's wall clock — never on whatever timezone the server, a developer's
 * laptop or a hosting region happens to be set to. Keeping the zone in a single
 * constant is what stops a day boundary computed in one place from disagreeing
 * with the date printed in another.
 */
export const RESTAURANT_TIME_ZONE = "Europe/Berlin";
