"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import FilterBar, { type Filters } from "@/components/FilterBar";
import KpiStrip from "@/components/KpiStrip";
import PnlTable from "@/components/PnlTable";
import RecentHighlights from "@/components/RecentHighlights";
import PropertyBreakdown from "@/components/PropertyBreakdown";
import {
  fetchDateRange,
  fetchDepartments,
  fetchDrilldown,
  fetchStatement,
  fetchTrend,
  fmt,
} from "@/lib/api";
import PnlCharts from "@/components/PnlCharts";
import { todayLocal } from "@/lib/dates";

const YEAR = new Date().getFullYear();

/** Strip the GL code for display, matching the server-side rule. */
function stripCode(name: string) {
  const m = name.match(/^[0-9]+(-[0-9]+)*\s+(\S.*)$/);
  return m ? m[2] : name;
}

export default function Page() {
  const defaultFilters: Filters = {
    start: "2018-01-01",
    end: todayLocal(),
    department: "",
    compareTo: "prior_year",
  };
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [drill, setDrill] = useState<string | null>(null);

  const depts = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });

  const loaded = useQuery({
    queryKey: ["date-range"],
    queryFn: fetchDateRange,
  });

  // Header shows the display name; the filter still keys off the raw value.
  const selectedLabel =
    depts.data?.departments.find((d) => d.department === filters.department)
      ?.department_display ?? filters.department;

  const statement = useQuery({
    queryKey: ["statement", filters],
    queryFn: () =>
      fetchStatement(
        filters.start,
        filters.end,
        filters.department || undefined,
        filters.compareTo || undefined
      ),
  });

  const trend = useQuery({
    queryKey: ["trend", filters.start, filters.end, filters.department],
    queryFn: () =>
      fetchTrend(
        filters.start,
        filters.end,
        filters.department || undefined
      ),
  });

  const drilldown = useQuery({
    queryKey: ["drilldown", filters.start, filters.end, filters.department, drill],
    queryFn: () =>
      fetchDrilldown(
        filters.start,
        filters.end,
        drill!,
        filters.department || undefined
      ),
    enabled: Boolean(drill),
  });

  return (
    <main className="relative min-w-0 flex-1 px-10 py-6 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        {/* Left: icon + title + subtitle */}
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 mt-0.5"
            style={{ background: "#dbeafe", color: "#2563eb" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
              Profit &amp; Loss
              {statement.isSuccess && !statement.isFetching && (
                <span
                  className="text-xs font-normal px-2 py-0.5 rounded-full border"
                  style={{ background: "#dcfce7", color: "#16a34a", borderColor: "#bbf7d0" }}
                >
                  ● Updated just now
                </span>
              )}
            </h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Track income and expenses across your properties
            </p>
          </div>
        </div>

        {/* Right: info card */}
        {loaded.data && (
          <div
            className="panel flex items-start gap-2.5 px-4 py-3 max-w-sm"
            style={{ borderRadius: "12px" }}
          >
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="text-xs text-[var(--color-muted)] leading-relaxed">
              <p>Credit positive, debit negative — expenses show as negative.</p>
              <p className="mt-0.5">
                Ledger data loaded: <span className="font-medium text-[var(--color-ink)]">{loaded.data.min_date}</span> to{" "}
                <span className="font-medium text-[var(--color-ink)]">{loaded.data.max_date}</span>
                {" "}({loaded.data.row_count.toLocaleString()} rows)
              </p>
            </div>
          </div>
        )}
      </header>

      <FilterBar
        filters={filters}
        departments={
          depts.data?.departments.map((d) => ({
            value: d.department,
            label: d.department_display,
          })) ?? []
        }
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
      />

      {/* A period that reaches outside the loaded data returns zeros, which
          reads as a bug unless we say why. */}
      {loaded.data && filters.start < loaded.data.min_date && (
        <div className="panel px-3 py-2 text-xs">
          Selected period starts before the loaded ledger ({loaded.data.min_date}).
          Any earlier months will show zero until that history is loaded.
        </div>
      )}

      {(statement.isLoading || trend.isLoading) && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="panel h-[90px] bg-[var(--color-input)] opacity-50"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="panel lg:col-span-2 h-[350px] bg-[var(--color-input)] opacity-50"></div>
            <div className="panel h-[350px] bg-[var(--color-input)] opacity-50"></div>
          </div>
          <div className="panel h-[400px] bg-[var(--color-input)] opacity-50 animate-pulse"></div>
        </div>
      )}

      {(statement.isError || trend.isError) && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          <div className="font-medium">Could not load the P&amp;L</div>
          <div className="mt-1">{(statement.error as Error)?.message || (trend.error as Error)?.message}</div>
        </div>
      )}

      {statement.data && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <KpiStrip current={statement.data.current.kpis} comparison={statement.data.comparison?.kpis} />

          {trend.data && (
            <PnlCharts trendData={trend.data.points} statementData={statement.data} />
          )}

          {statement.data.comparison && (
            <RecentHighlights
              current={statement.data.current.kpis}
              comparison={statement.data.comparison.kpis}
            />
          )}

          <div className="mt-6">
            <PnlTable
              statement={statement.data.current}
              comparison={statement.data.comparison}
              comparisonLabel={
                filters.compareTo === "prior_year" ? "Prior year" : "Prior period"
              }
              onDrilldown={setDrill}
            />
          </div>

          {/* By-Property breakdown — only meaningful when "All properties" is selected */}
          {!filters.department && (
            <PropertyBreakdown start={filters.start} end={filters.end} />
          )}
        </div>
      )}

      {drill && (
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{stripCode(drill)}</h2>
            <button
              className="text-sm text-[var(--color-muted)] hover:underline"
              onClick={() => setDrill(null)}
            >
              Close
            </button>
          </div>

          {drilldown.isLoading && (
            <p className="text-sm text-[var(--color-muted)]">
              Loading transactions&hellip;
            </p>
          )}

          {drilldown.data && drilldown.data.lines.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">
              No transactions in this period.
            </p>
          )}

          {drilldown.data && drilldown.data.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-xs uppercase text-[var(--color-muted)]">
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Type</th>
                    <th className="px-2 py-1.5 text-left">Doc</th>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left">Offset account</th>
                    <th className="px-2 py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.data.lines.map((l, i) => (
                    <tr
                      key={i}
                      className="border-t"
                      style={{ borderColor: "var(--color-line)" }}
                    >
                      <td className="px-2 py-1.5">{l.date}</td>
                      <td className="px-2 py-1.5">{l.transaction_type ?? ""}</td>
                      <td className="px-2 py-1.5">{l.document_number ?? ""}</td>
                      <td className="px-2 py-1.5">{l.counterparty ?? ""}</td>
                      <td className="px-2 py-1.5 text-[var(--color-muted)]">
                        {l.description ?? ""}
                      </td>
                      <td className="px-2 py-1.5 text-[var(--color-muted)]">
                        {l.split_account ? stripCode(l.split_account) : ""}
                      </td>
                      <td className="num px-2 py-1.5">{fmt(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
