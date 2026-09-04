"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import FilterBar, { type Filters } from "@/components/FilterBar";
import KpiStrip from "@/components/KpiStrip";
import PnlTable from "@/components/PnlTable";
import {
  fetchDateRange,
  fetchDepartments,
  fetchDrilldown,
  fetchStatement,
  fmt,
} from "@/lib/api";
import { todayLocal } from "@/lib/dates";

const YEAR = new Date().getFullYear();

/** Strip the GL code for display, matching the server-side rule. */
function stripCode(name: string) {
  const m = name.match(/^[0-9]+(-[0-9]+)*\s+(\S.*)$/);
  return m ? m[2] : name;
}

export default function Page() {
  const [filters, setFilters] = useState<Filters>({
    start: `${YEAR}-01-01`,
    // Local calendar date, not toISOString() -- see the note on iso() in
    // FilterBar.tsx. In UTC+ timezones toISOString() yields yesterday.
    end: todayLocal(),
    department: "",
    compareTo: "prior_year",
  });
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
    <main className="mx-auto max-w-6xl space-y-5 p-5 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Profit &amp; Loss</h1>
          <p className="text-sm text-[var(--muted)]">
            {selectedLabel || "All properties"} &middot; {filters.start} to{" "}
            {filters.end}
          </p>
        </div>
        <div className="text-right text-xs text-[var(--muted)]">
          <p>Credit positive, debit negative &mdash; expenses show as negative.</p>
          {loaded.data && (
            <p className="mt-0.5">
              Ledger data loaded: {loaded.data.min_date} to {loaded.data.max_date}
              {" "}({loaded.data.row_count.toLocaleString()} rows)
            </p>
          )}
        </div>
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
      />

      {/* A period that reaches outside the loaded data returns zeros, which
          reads as a bug unless we say why. */}
      {loaded.data && filters.start < loaded.data.min_date && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          Selected period starts before the loaded ledger ({loaded.data.min_date}).
          Any earlier months will show zero until that history is loaded.
        </div>
      )}

      {statement.isLoading && (
        <div
          className="rounded-lg border p-8 text-center text-sm text-[var(--muted)]"
          style={{ borderColor: "var(--border)" }}
        >
          Querying BigQuery&hellip;
        </div>
      )}

      {statement.isError && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          <div className="font-medium">Could not load the P&amp;L</div>
          <div className="mt-1">{(statement.error as Error).message}</div>
        </div>
      )}

      {statement.data && (
        <>
          <KpiStrip kpis={statement.data.current.kpis} />
          <PnlTable
            statement={statement.data.current}
            comparison={statement.data.comparison}
            comparisonLabel={
              filters.compareTo === "prior_year" ? "Prior year" : "Prior period"
            }
            onDrilldown={setDrill}
          />
        </>
      )}

      {drill && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{stripCode(drill)}</h2>
            <button
              className="text-sm text-[var(--muted)] hover:underline"
              onClick={() => setDrill(null)}
            >
              Close
            </button>
          </div>

          {drilldown.isLoading && (
            <p className="text-sm text-[var(--muted)]">
              Loading transactions&hellip;
            </p>
          )}

          {drilldown.data && drilldown.data.lines.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              No transactions in this period.
            </p>
          )}

          {drilldown.data && drilldown.data.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-xs uppercase text-[var(--muted)]">
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
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-2 py-1.5">{l.date}</td>
                      <td className="px-2 py-1.5">{l.transaction_type ?? ""}</td>
                      <td className="px-2 py-1.5">{l.document_number ?? ""}</td>
                      <td className="px-2 py-1.5">{l.counterparty ?? ""}</td>
                      <td className="px-2 py-1.5 text-[var(--muted)]">
                        {l.description ?? ""}
                      </td>
                      <td className="px-2 py-1.5 text-[var(--muted)]">
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
