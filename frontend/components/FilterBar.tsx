"use client";

import { useEffect, useState } from "react";
import { isoLocal as iso, monthEnd, monthStart, todayLocal } from "@/lib/dates";
import Select from "@/components/Select";

export type Filters = {
  start: string;
  end: string;
  department: string;
  compareTo: "" | "prior_period" | "prior_year";
};

export const DATA_PERIOD_START = "2018-01-01";

const PRESETS: { label: string; fn: () => { start: string; end: string } }[] = [
  { label: "This month", fn: () => ({ start: iso(monthStart(0)), end: todayLocal() }) },
  { label: "Last month", fn: () => ({ start: iso(monthStart(-1)), end: iso(monthEnd(-1)) }) },
  {
    label: "This quarter",
    fn: () => {
      const n = new Date();
      const q = Math.floor(n.getMonth() / 3);
      return { start: iso(new Date(n.getFullYear(), q * 3, 1)), end: todayLocal() };
    },
  },
  {
    label: "YTD",
    fn: () => ({ start: iso(new Date(new Date().getFullYear(), 0, 1)), end: todayLocal() }),
  },
  {
    label: "Last year",
    fn: () => {
      const y = new Date().getFullYear() - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    },
  },
  { label: "Since 2018", fn: () => ({ start: DATA_PERIOD_START, end: todayLocal() }) },
];

export default function FilterBar({
  filters,
  departments,
  onChange,
  onReset,
}: {
  filters: Filters;
  departments: { value: string; label: string }[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Keep local state in sync when parent resets filters
  useEffect(() => {
    setLocal(filters);
    setActivePreset(null);
  }, [filters]);

  const cls =
    "rounded border bg-[var(--color-input)] px-2 py-1.5 text-sm transition-colors duration-150 focus:outline-none";
  const borderStyle = { borderColor: "var(--color-line)" };

  // Manual date/property/compare changes just update local display.
  // User must then click "Load Data" to fetch.
  const handleLocalChange = (patch: Partial<Filters>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    setActivePreset(null);
  };

  // ✅ Preset buttons immediately fire onChange — no extra click needed.
  const handlePreset = (preset: (typeof PRESETS)[0]) => {
    const dates = preset.fn();
    const next: Filters = { ...local, ...dates };
    setLocal(next);
    setActivePreset(preset.label);
    onChange(next);
  };

  const handleApply = () => onChange(local);

  const handleReset = () => {
    setActivePreset(null);
    onReset();
  };

  return (
    <div className="panel flex flex-wrap items-end gap-4 p-4">
      {/* From */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-muted)]">From</span>
        <input
          type="date"
          className={cls}
          style={borderStyle}
          min={DATA_PERIOD_START}
          value={local.start}
          onChange={(e) => handleLocalChange({ start: e.target.value })}
        />
      </label>

      {/* To */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-muted)]">To</span>
        <input
          type="date"
          className={cls}
          style={borderStyle}
          min={DATA_PERIOD_START}
          value={local.end}
          onChange={(e) => handleLocalChange({ end: e.target.value })}
        />
      </label>

      {/* Property */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-muted)]">Property</span>
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
        <span className="text-xs font-medium text-[var(--color-muted)]">Compare to</span>
        <Select
          value={local.compareTo}
          placeholder="No comparison"
          options={[
            { value: "", label: "No comparison" },
            { value: "prior_period", label: "Prior period" },
            { value: "prior_year", label: "Prior year" },
          ]}
          onChange={(v) => handleLocalChange({ compareTo: v as Filters["compareTo"] })}
          icon={
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
      </div>

      {/* Quick preset buttons — each one IMMEDIATELY loads data */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-muted)]">Quick ranges</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const isActive = activePreset === p.label;
            return (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className="rounded border px-2.5 py-1 text-xs font-medium transition-all duration-150 hover:opacity-90"
                style={
                  isActive
                    ? {
                        background: "var(--neo-accent)",
                        color: "#fff",
                        borderColor: "var(--neo-accent)",
                        boxShadow: "0 0 0 2px rgba(6,182,212,0.2)",
                      }
                    : {
                        background: "var(--color-input)",
                        color: "var(--color-ink)",
                        borderColor: "var(--color-line)",
                      }
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset + Load Data */}
      <div className="ml-auto flex gap-2 self-end">
        <button
          className="rounded border px-4 py-1.5 text-sm hover:bg-[var(--color-input)] transition-colors duration-150"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <button
          className="rounded px-4 py-1.5 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          style={{ background: "var(--neo-accent)" }}
          onClick={handleApply}
        >
          ▶ Load Data
        </button>
      </div>
    </div>
  );
}
