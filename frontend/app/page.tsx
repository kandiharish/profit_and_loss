"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import FilterBar, { type Filters } from "@/components/FilterBar";
import KpiStrip from "@/components/KpiStrip";
import PnlTable from "@/components/PnlTable";
import RecentHighlights from "@/components/RecentHighlights";
import PropertyBreakdown from "@/components/PropertyBreakdown";
import {
  fetchCompanies,
  fetchDateRange,
  fetchDepartments,
  fetchStatement,
  fetchTrend,
} from "@/lib/api";
import PnlCharts from "@/components/PnlCharts";
import StatementTabs, { type TabKey } from "@/components/StatementTabs";
import ThemeToggle from "@/components/ThemeToggle";
import BalanceSheetTable from "@/components/BalanceSheetTable";
import LedgerEntries from "@/components/LedgerEntries";
import { fetchBalanceSheet } from "@/lib/api";
import { todayLocal } from "@/lib/dates";

/**
 * Strapline for the active tab.
 *
 * There is no heading any more: the tabs sit where it was and already name
 * the view, so an <h1> would just repeat the selected tab back at the user.
 */
const TAB_SUBTITLE: Record<TabKey, string> = {
  balance_sheet: "Assets, liabilities and equity as at a date",
  pnl: "Track income and expenses across your properties",
  ledger: "Every general ledger line behind the statements",
};

const YEAR = new Date().getFullYear();

export default function Page() {
  const defaultFilters: Filters = {
    start: "2018-01-01",
    end: todayLocal(),
    department: "",
    company: "",
    compareTo: "prior_year",
  };
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tab, setTab] = useState<TabKey>("pnl");

  const depts = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });

  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
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
        filters.compareTo || undefined,
        filters.company || undefined
      ),
    // Each tab pays for its own BigQuery jobs, and only while it is showing.
    enabled: tab === "pnl",
  });

  const trend = useQuery({
    queryKey: ["trend", filters.start, filters.end, filters.department],
    queryFn: () =>
      fetchTrend(
        filters.start,
        filters.end,
        filters.department || undefined,
        filters.company || undefined
      ),
    enabled: tab === "pnl",
  });

  // A balance sheet is a position, not a period: only the To date applies.
  const balanceSheet = useQuery({
    queryKey: ["balance-sheet", filters.end, filters.department, filters.company],
    queryFn: () =>
      fetchBalanceSheet(
        filters.end,
        filters.department || undefined,
        filters.company || undefined
      ),
    enabled: tab === "balance_sheet",
  });

  /**
   * Every entry behind a statement figure lives on its own route, so it can
   * be opened in a new tab, deep-linked and left with the Back button. The
   * whole filter travels in the URL; `expected` lets that page prove it
   * reconciles to the figure that was clicked.
   */
  const entriesHref = (
    sectionKey: string,
    ledgerName: string,
    amount: number
  ) => {
    const section = statement.data?.current.sections.find(
      (s) => s.key === sectionKey
    );
    const q = new URLSearchParams({
      ledger: ledgerName,
      start: filters.start,
      end: filters.end,
      expected: String(amount),
    });
    if (section) q.set("section", section.label);
    if (filters.company) q.set("company", filters.company);
    if (filters.department) q.set("department", filters.department);
    return `/entries?${q}`;
  };

  // The badge should describe the tab being looked at, not whichever query
  // happened to resolve last.
  const activeQuery =
    tab === "pnl" ? statement : tab === "balance_sheet" ? balanceSheet : null;
  const tabIsFresh = Boolean(
    activeQuery?.isSuccess && !activeQuery.isFetching
  );

  return (
    <main className="relative min-w-0 flex-1 px-10 py-6 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        {/* Left: icon + tabs (they are the heading) + strapline */}
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded flex-shrink-0"
            style={{ background: "var(--tint-blue)", color: "var(--tint-blue-ink)" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatementTabs active={tab} onChange={setTab} />
              {tabIsFresh && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full border"
                  style={{ background: "var(--tint-green)", color: "var(--tint-green-ink)", borderColor: "var(--color-line)" }}
                >
                  ● Updated just now
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              {TAB_SUBTITLE[tab]}
            </p>
          </div>
        </div>

        {/* Right: theme */}
        <ThemeToggle />
      </header>

      <FilterBar
        filters={filters}
        departments={
          depts.data?.departments.map((d) => ({
            value: d.department,
            label: d.department_display,
          })) ?? []
        }
        companies={
          companies.data?.companies.map((c) => ({
            value: c.company_name,
            label: c.company_name,
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

      {tab === "balance_sheet" && (
        <>
          {balanceSheet.isLoading && (
            <div className="panel h-[420px] animate-pulse bg-[var(--color-hover)] opacity-50" />
          )}
          {balanceSheet.isError && (
            <div
              className="rounded border p-4 text-sm"
              style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
            >
              <div className="font-medium">Could not load the balance sheet</div>
              <div className="mt-1">{(balanceSheet.error as Error)?.message}</div>
            </div>
          )}
          {balanceSheet.data && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <BalanceSheetTable data={balanceSheet.data} />
            </div>
          )}
        </>
      )}

      {tab === "ledger" && (
        <LedgerEntries
          start={filters.start}
          end={filters.end}
          department={filters.department || undefined}
          company={filters.company || undefined}
        />
      )}

      {tab === "pnl" && (statement.isLoading || trend.isLoading) && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="panel h-[90px] bg-[var(--color-hover)] opacity-50"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="panel lg:col-span-2 h-[350px] bg-[var(--color-hover)] opacity-50"></div>
            <div className="panel h-[350px] bg-[var(--color-hover)] opacity-50"></div>
          </div>
          <div className="panel h-[400px] bg-[var(--color-hover)] opacity-50 animate-pulse"></div>
        </div>
      )}

      {tab === "pnl" && (statement.isError || trend.isError) && (
        <div
          className="rounded border p-4 text-sm"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          <div className="font-medium">Could not load the P&amp;L</div>
          <div className="mt-1">{(statement.error as Error)?.message || (trend.error as Error)?.message}</div>
        </div>
      )}

      {tab === "pnl" && statement.data && (
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
              hrefFor={entriesHref}
            />
          </div>

          {/* By-Property breakdown — only meaningful when "All properties" is selected */}
          {!filters.department && (
            <PropertyBreakdown start={filters.start} end={filters.end} />
          )}
        </div>
      )}

    </main>
  );
}
