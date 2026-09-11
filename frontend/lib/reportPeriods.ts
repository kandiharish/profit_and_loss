/**
 * QuickBooks-style report periods.
 *
 * The client works in QuickBooks all day, so the period list, its wording
 * and its ordering follow QuickBooks Online rather than anything invented
 * here. "Custom dates" is what a hand-typed range falls back to, exactly as
 * it does in QBO.
 *
 * Two settings drive every fiscal variant. QuickBooks defaults to a January
 * fiscal year start and a Sunday week start; change these two constants and
 * the whole list follows.
 */

import { isoLocal } from "@/lib/dates";

/** 1 = January. QuickBooks' default fiscal year start. */
export const FISCAL_YEAR_START_MONTH = 1;

/** 0 = Sunday. QuickBooks' default week start. */
export const WEEK_START_DAY = 0;

export const CUSTOM_LABEL = "Custom dates";
export const ALL_DATES_LABEL = "All Dates";

/** Earliest date the ledger reports from. */
export const DATA_START = "2018-01-01";

export type Range = { start: string; end: string };

/* ---------------------------------------------------------------- */
/* Local-calendar helpers. Never toISOString() — see lib/dates.ts.    */
/* ---------------------------------------------------------------- */

const at = (y: number, m: number, d: number) => new Date(y, m, d);

function addDays(base: Date, n: number): Date {
  return at(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

function weekStart(base: Date, offsetWeeks = 0): Date {
  const diff = (base.getDay() - WEEK_START_DAY + 7) % 7;
  return addDays(base, -diff + offsetWeeks * 7);
}

function monthStartOf(base: Date, offsetMonths = 0): Date {
  return at(base.getFullYear(), base.getMonth() + offsetMonths, 1);
}

function monthEndOf(base: Date, offsetMonths = 0): Date {
  // Day 0 of the next month is the last day of this one.
  return at(base.getFullYear(), base.getMonth() + offsetMonths + 1, 0);
}

function quarterStartOf(base: Date, offsetQuarters = 0): Date {
  const q = Math.floor(base.getMonth() / 3) + offsetQuarters;
  return at(base.getFullYear(), q * 3, 1);
}

function quarterEndOf(base: Date, offsetQuarters = 0): Date {
  const s = quarterStartOf(base, offsetQuarters);
  return at(s.getFullYear(), s.getMonth() + 3, 0);
}

function yearStartOf(base: Date, offsetYears = 0): Date {
  return at(base.getFullYear() + offsetYears, 0, 1);
}

function yearEndOf(base: Date, offsetYears = 0): Date {
  return at(base.getFullYear() + offsetYears, 11, 31);
}

/** Start of the fiscal year containing `base`, shifted by whole years. */
function fiscalYearStartOf(base: Date, offsetYears = 0): Date {
  const m = FISCAL_YEAR_START_MONTH - 1;
  const y = base.getMonth() >= m ? base.getFullYear() : base.getFullYear() - 1;
  return at(y + offsetYears, m, 1);
}

function fiscalYearEndOf(base: Date, offsetYears = 0): Date {
  const s = fiscalYearStartOf(base, offsetYears);
  return at(s.getFullYear() + 1, s.getMonth(), 0);
}

/** Start of the fiscal quarter containing `base`, shifted by whole quarters. */
function fiscalQuarterStartOf(base: Date, offsetQuarters = 0): Date {
  const fyStart = fiscalYearStartOf(base);
  const monthsIn =
    (base.getFullYear() - fyStart.getFullYear()) * 12 +
    (base.getMonth() - fyStart.getMonth());
  const q = Math.floor(monthsIn / 3) + offsetQuarters;
  return at(fyStart.getFullYear(), fyStart.getMonth() + q * 3, 1);
}

function fiscalQuarterEndOf(base: Date, offsetQuarters = 0): Date {
  const s = fiscalQuarterStartOf(base, offsetQuarters);
  return at(s.getFullYear(), s.getMonth() + 3, 0);
}

const r = (a: Date, b: Date): Range => ({ start: isoLocal(a), end: isoLocal(b) });

export type ReportPeriod = {
  label: string;
  /** null for "Custom dates", which never computes a range of its own. */
  range: ((today: Date) => Range) | null;
};

/**
 * Ordered exactly as QuickBooks Online lists them.
 */
export const REPORT_PERIODS: ReportPeriod[] = [
  { label: ALL_DATES_LABEL, range: (t) => ({ start: DATA_START, end: isoLocal(t) }) },
  { label: CUSTOM_LABEL, range: null },

  { label: "Today", range: (t) => r(t, t) },
  { label: "This week", range: (t) => r(weekStart(t), addDays(weekStart(t), 6)) },
  { label: "This week to date", range: (t) => r(weekStart(t), t) },
  { label: "This fiscal week", range: (t) => r(weekStart(t), addDays(weekStart(t), 6)) },
  { label: "This month", range: (t) => r(monthStartOf(t), monthEndOf(t)) },
  { label: "This month to date", range: (t) => r(monthStartOf(t), t) },
  { label: "This quarter", range: (t) => r(quarterStartOf(t), quarterEndOf(t)) },
  { label: "This quarter to date", range: (t) => r(quarterStartOf(t), t) },
  { label: "This fiscal quarter", range: (t) => r(fiscalQuarterStartOf(t), fiscalQuarterEndOf(t)) },
  { label: "This fiscal quarter to date", range: (t) => r(fiscalQuarterStartOf(t), t) },
  { label: "This year", range: (t) => r(yearStartOf(t), yearEndOf(t)) },
  { label: "This year to date", range: (t) => r(yearStartOf(t), t) },
  { label: "This fiscal year", range: (t) => r(fiscalYearStartOf(t), fiscalYearEndOf(t)) },
  { label: "This fiscal year to date", range: (t) => r(fiscalYearStartOf(t), t) },

  { label: "Yesterday", range: (t) => r(addDays(t, -1), addDays(t, -1)) },
  { label: "Last week", range: (t) => r(weekStart(t, -1), addDays(weekStart(t, -1), 6)) },
  { label: "Last week to date", range: (t) => r(weekStart(t, -1), addDays(t, -7)) },
  { label: "Last fiscal week", range: (t) => r(weekStart(t, -1), addDays(weekStart(t, -1), 6)) },
  { label: "Last month", range: (t) => r(monthStartOf(t, -1), monthEndOf(t, -1)) },
  {
    label: "Last month to date",
    range: (t) => r(monthStartOf(t, -1), at(t.getFullYear(), t.getMonth() - 1, t.getDate())),
  },
  { label: "Last quarter", range: (t) => r(quarterStartOf(t, -1), quarterEndOf(t, -1)) },
  {
    label: "Last quarter to date",
    range: (t) => r(quarterStartOf(t, -1), at(t.getFullYear(), t.getMonth() - 3, t.getDate())),
  },
  { label: "Last fiscal quarter", range: (t) => r(fiscalQuarterStartOf(t, -1), fiscalQuarterEndOf(t, -1)) },
  {
    label: "Last fiscal quarter to date",
    range: (t) => r(fiscalQuarterStartOf(t, -1), at(t.getFullYear(), t.getMonth() - 3, t.getDate())),
  },
  { label: "Last year", range: (t) => r(yearStartOf(t, -1), yearEndOf(t, -1)) },
  {
    label: "Last year to date",
    range: (t) => r(yearStartOf(t, -1), at(t.getFullYear() - 1, t.getMonth(), t.getDate())),
  },
  { label: "Last fiscal year", range: (t) => r(fiscalYearStartOf(t, -1), fiscalYearEndOf(t, -1)) },
  {
    label: "Last fiscal year to date",
    range: (t) => r(fiscalYearStartOf(t, -1), at(t.getFullYear() - 1, t.getMonth(), t.getDate())),
  },

  { label: "Since 30 days ago", range: (t) => r(addDays(t, -30), t) },
  { label: "Since 60 days ago", range: (t) => r(addDays(t, -60), t) },
  { label: "Since 90 days ago", range: (t) => r(addDays(t, -90), t) },
  { label: "Since 365 days ago", range: (t) => r(addDays(t, -365), t) },
];

/**
 * Which period a range corresponds to, or "Custom dates".
 *
 * QuickBooks re-labels the dropdown the moment a typed range stops matching
 * the named period, so the label never claims something the dates do not say.
 */
export function matchPeriod(start: string, end: string, today = new Date()): string {
  for (const p of REPORT_PERIODS) {
    if (!p.range || p.label === CUSTOM_LABEL) continue;
    const got = p.range(today);
    if (got.start === start && got.end === end) return p.label;
  }
  return CUSTOM_LABEL;
}

/* ---------------------------------------------------------------- */
/* MM/DD/YYYY — the format QuickBooks shows                          */
/* ---------------------------------------------------------------- */

/** "2026-09-10" -> "09/10/2026". Empty string for anything unparseable. */
export function toUsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
}

/**
 * "09/10/2026" -> "2026-09-10", or null if it is not a real date.
 *
 * Accepts 1- or 2-digit month/day and 2- or 4-digit years, because people
 * type "9/1/26". The round-trip check rejects impossible dates such as
 * 02/31/2026, which the Date constructor would otherwise roll into March.
 */
export function fromUsDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec((text ?? "").trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += year >= 70 ? 1900 : 2000;
  const d = at(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return isoLocal(d);
}
