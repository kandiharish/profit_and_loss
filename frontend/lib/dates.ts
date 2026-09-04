/**
 * Local-calendar date helpers.
 *
 * NEVER use `d.toISOString().slice(0, 10)` to get a calendar date.
 * toISOString() converts to UTC first, so local midnight in any UTC+
 * timezone rolls back a day. In IST (+5:30) `new Date(2026, 7, 1)` — the
 * 1st of August — came out as "2026-07-31", which made the "Last month"
 * preset read 31-07-2026 to 30-08-2026 instead of 01-08 to 31-08. Every
 * preset was off by one, and YTD started in the previous year.
 *
 * These functions read the local date parts directly, so the string always
 * matches what the user sees on their own calendar.
 */

/** Format a Date as YYYY-MM-DD from its local calendar date. */
export function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today, as YYYY-MM-DD in the viewer's own timezone. */
export function todayLocal(): string {
  return isoLocal(new Date());
}

/** First day of the month `offset` months from now (0 = this month). */
export function monthStart(offset = 0): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + offset, 1);
}

/** Last day of the month `offset` months from now (0 = this month). */
export function monthEnd(offset = 0): Date {
  const n = new Date();
  // Day 0 of the next month is the last day of this one.
  return new Date(n.getFullYear(), n.getMonth() + offset + 1, 0);
}
