"use client";

import { isoLocal as iso, monthEnd, monthStart, todayLocal } from "@/lib/dates";

export type Filters = {
  start: string;
  end: string;
  department: string;
  compareTo: "" | "prior_period" | "prior_year";
};

/**
 * Earliest period the tool reports on. Opened back to January 2018 so
 * prior-year comparison has historical data to reach into.
 *
 * Note this is the reporting window, not a claim about what BigQuery holds —
 * the UI shows the actual loaded range separately.
 */
export const DATA_PERIOD_START = "2018-01-01";

const PRESETS = [
  {
    // Month-to-date: ends today, not at the end of the calendar month, so
    // the period never reaches into future dates with no transactions.
    label: "This month",
    fn: () => ({ start: iso(monthStart(0)), end: todayLocal() }),
  },
  {
    // A completed month, so this one DOES run to the calendar month end.
    label: "Last month",
    fn: () => ({ start: iso(monthStart(-1)), end: iso(monthEnd(-1)) }),
  },
  {
    // Quarter-to-date, same reasoning as "This month".
    label: "This quarter",
    fn: () => {
      const n = new Date();
      const q = Math.floor(n.getMonth() / 3);
      return {
        start: iso(new Date(n.getFullYear(), q * 3, 1)),
        end: todayLocal(),
      };
    },
  },
  {
    label: "YTD",
    fn: () => ({
      start: iso(new Date(new Date().getFullYear(), 0, 1)),
      end: todayLocal(),
    }),
  },
  {
    label: "Last year",
    fn: () => {
      const y = new Date().getFullYear() - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    },
  },
  {
    // The reporting period opens at January 2018 so prior-year comparison
    // has historical data to reach into once it is loaded.
    label: "Since 2018",
    fn: () => ({ start: DATA_PERIOD_START, end: todayLocal() }),
  },
];

export default function FilterBar({
  filters,
  departments,
  onChange,
}: {
  filters: Filters;
  /** value = raw department (the filter key); label = display name. */
  departments: { value: string; label: string }[];
  onChange: (f: Filters) => void;
}) {
  const cls = "rounded border bg-transparent px-2 py-1.5 text-sm";
  const style = { borderColor: "var(--border)" };

  return (
    <div
      className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--muted)]">From</span>
        <input
          type="date"
          className={cls}
          style={style}
          min={DATA_PERIOD_START}
          value={filters.start}
          onChange={(e) => onChange({ ...filters, start: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--muted)]">To</span>
        <input
          type="date"
          className={cls}
          style={style}
          min={DATA_PERIOD_START}
          value={filters.end}
          onChange={(e) => onChange({ ...filters, end: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--muted)]">Property</span>
        <select
          className={cls}
          style={style}
          value={filters.department}
          onChange={(e) => onChange({ ...filters, department: e.target.value })}
        >
          <option value="">All properties</option>
          {departments.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--muted)]">Compare to</span>
        <select
          className={cls}
          style={style}
          value={filters.compareTo}
          onChange={(e) =>
            onChange({
              ...filters,
              compareTo: e.target.value as Filters["compareTo"],
            })
          }
        >
          <option value="">No comparison</option>
          <option value="prior_period">Prior period</option>
          <option value="prior_year">Prior year</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg)]"
            style={style}
            onClick={() => onChange({ ...filters, ...p.fn() })}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
