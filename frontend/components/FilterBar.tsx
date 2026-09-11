"use client";

import { useEffect, useState } from "react";
import { todayLocal } from "@/lib/dates";
import Select from "@/components/Select";
import DateField from "@/components/DateField";
import {
  CUSTOM_LABEL,
  DATA_START,
  REPORT_PERIODS,
  matchPeriod,
} from "@/lib/reportPeriods";

export type Filters = {
  start: string;
  end: string;
  department: string;
  company: string;
  compareTo: "" | "prior_period" | "prior_year";
};

export const DATA_PERIOD_START = DATA_START;

/**
 * The report toolbar, laid out the way QuickBooks lays it out:
 *
 *   Report period | From | To | Company | Property | Compare to
 *
 * Deliberately absent: the Cash/Accrual switch. This ledger is accrual and
 * offering a toggle that changed nothing would be worse than not offering it.
 *
 * Picking a named period loads immediately, as QuickBooks does. Typing dates
 * by hand does not — it flips the dropdown to "Custom dates" and waits for
 * Load Data, so a half-typed year never fires a BigQuery job.
 */
export default function FilterBar({
  filters,
  departments,
  companies,
  onChange,
  onReset,
}: {
  filters: Filters;
  departments: { value: string; label: string }[];
  companies: { value: string; label: string }[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters]);

  const label = "text-xs font-medium text-[var(--color-muted)]";

  const handleLocalChange = (patch: Partial<Filters>) =>
    setLocal((prev) => ({ ...prev, ...patch }));

  /** A named period is an explicit choice, so it loads straight away. */
  const handlePeriod = (name: string) => {
    const preset = REPORT_PERIODS.find((p) => p.label === name);
    if (!preset || !preset.range) {
      // "Custom dates" keeps whatever is in the boxes.
      setLocal((prev) => ({ ...prev }));
      return;
    }
    const next = { ...local, ...preset.range(new Date()) };
    setLocal(next);
    onChange(next);
  };

  // The dropdown always reports what the dates actually say.
  const period = matchPeriod(local.start, local.end);

  return (
    <div className="panel flex flex-wrap items-end gap-4 p-4">
      {/* Report period */}
      <div className="flex flex-col gap-1">
        <span className={label}>Report period</span>
        <div className="w-[190px]">
          <Select
            value={period}
            placeholder={CUSTOM_LABEL}
            options={REPORT_PERIODS.map((p) => ({
              value: p.label,
              label: p.label,
            }))}
            onChange={handlePeriod}
          />
        </div>
      </div>

      {/* From */}
      <div className="flex flex-col gap-1">
        <span className={label}>From</span>
        <DateField
          ariaLabel="From date"
          min={DATA_PERIOD_START}
          value={local.start}
          onChange={(iso) => handleLocalChange({ start: iso })}
        />
      </div>

      {/* To */}
      <div className="flex flex-col gap-1">
        <span className={label}>To</span>
        <DateField
          ariaLabel="To date"
          min={DATA_PERIOD_START}
          value={local.end}
          onChange={(iso) => handleLocalChange({ end: iso })}
        />
      </div>

      {/* Company */}
      <div className="flex flex-col gap-1">
        <span className={label}>Company</span>
        <Select
          value={local.company}
          placeholder="All companies"
          options={[
            { value: "", label: "All companies" },
            ...companies,
          ]}
          onChange={(v) => handleLocalChange({ company: v })}
          icon={
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="7" width="18" height="14" rx="2"/>
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          }
        />
      </div>

      {/* Property */}
      <div className="flex flex-col gap-1">
        <span className={label}>Property</span>
        <Select
          value={local.department}
          placeholder="All properties"
          options={[
            { value: "", label: "All properties" },
            ...departments.map((d) => ({ value: d.value, label: d.label })),
          ]}
          onChange={(v) => handleLocalChange({ department: v })}
          icon={
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          }
        />
      </div>

      {/* Compare to */}
      <div className="flex flex-col gap-1">
        <span className={label}>Compare to</span>
        <Select
          value={local.compareTo}
          placeholder="Select Period"
          options={[
            { value: "", label: "Select Period" },
            { value: "prior_period", label: "Previous period" },
            { value: "prior_year", label: "Previous year" },
          ]}
          onChange={(v) => handleLocalChange({ compareTo: v as Filters["compareTo"] })}
          icon={
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
      </div>

      {/* Reset + Load Data */}
      <div className="ml-auto flex gap-2 self-end">
        <button
          className="rounded border px-4 py-1.5 text-sm hover:bg-[var(--color-hover)] transition-colors duration-150"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          onClick={onReset}
        >
          ↺ Reset
        </button>
        <button
          className="rounded px-4 py-1.5 text-sm font-semibold text-white transition-colors duration-150"
          style={{ background: "var(--neo-accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-dark)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--neo-accent)")}
          onClick={() => onChange(local)}
        >
          ▶ Load Data
        </button>
      </div>
    </div>
  );
}
