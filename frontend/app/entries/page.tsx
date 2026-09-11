"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import EntriesTable from "@/components/EntriesTable";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchLedgerEntries, fmt } from "@/lib/api";
import { toUsDate } from "@/lib/reportPeriods";

const PAGE_SIZES = [200, 500, 1000];

/**
 * Every GL line behind one figure on the statement.
 *
 * Reached by clicking a ledger on the P&L. It is a real route rather than a
 * panel, so the drill-down can be opened in a new tab, deep-linked and
 * reached with the browser Back button — the whole filter travels in the URL.
 *
 * `pnl_only=true` is what makes the total trustworthy: it applies the same
 * `section_order <= 5` gate the statement uses, so the figure under the list
 * equals the figure that was clicked. If they ever disagree the page says so
 * rather than quietly showing a different number.
 */
function Entries() {
  const sp = useSearchParams();

  const ledger = sp.get("ledger") ?? "";
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  const company = sp.get("company") ?? "";
  const department = sp.get("department") ?? "";
  const sectionLabel = sp.get("section") ?? "";
  // What the statement showed, carried across purely to prove the tie-out.
  const expectedRaw = sp.get("expected");
  const expected = expectedRaw === null ? null : Number(expectedRaw);

  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [ledger, start, end, company, department, pageSize]);

  const q = useQuery({
    queryKey: [
      "entries-page", ledger, start, end, company, department, pageSize, offset,
    ],
    queryFn: () =>
      fetchLedgerEntries(start, end, {
        ledgerName: ledger,
        pnlOnly: true,
        company: company || undefined,
        department: department || undefined,
        limit: pageSize,
        offset,
      }),
    enabled: Boolean(ledger && start && end),
    placeholderData: keepPreviousData,
  });

  const net = q.data?.net_amount ?? 0;
  const ties =
    expected === null || !q.data ? null : Math.abs(net - expected) < 0.005;

  return (
    <main className="relative min-w-0 flex-1 space-y-5 px-10 py-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:underline"
          >
            <ArrowLeft size={15} />
            Back to Profit &amp; Loss
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {sectionLabel && (
              <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                {sectionLabel}
              </p>
            )}
            <h1 className="text-xl font-bold text-[var(--color-ink)]">
              {ledger || "No ledger selected"}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">
              {toUsDate(start)} to {toUsDate(end)}
              {company ? ` · ${company}` : " · All companies"}
              {department ? ` · ${department}` : ""}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Total
            </p>
            <p className="num text-2xl font-bold text-[var(--color-ink)]">
              {q.data ? fmt(net) : "—"}
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              {q.data ? `${q.data.total.toLocaleString()} entries` : ""}
            </p>
          </div>
        </div>

        {/* The drill-down is only worth anything if it adds up to the figure
            it was opened from, so that is stated, not assumed. */}
        {ties !== null && (
          <div
            className="rounded border px-3 py-2 text-xs"
            style={
              ties
                ? { borderColor: "var(--color-line)", color: "var(--color-muted)" }
                : { borderColor: "var(--negative)", color: "var(--negative)" }
            }
          >
            {ties ? (
              <>
                Reconciled to the statement:{" "}
                <span className="num font-medium text-[var(--color-ink)]">
                  {fmt(expected as number)}
                </span>
              </>
            ) : (
              <>
                These entries total {fmt(net)} but the statement shows{" "}
                {fmt(expected as number)}. Do not rely on either figure until
                this is resolved.
              </>
            )}
          </div>
        )}
      </header>

      <div className="flex items-center justify-end gap-2 text-xs">
        <span style={{ color: "var(--color-muted)" }}>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded border px-2 py-1"
          style={{
            borderColor: "var(--color-line)",
            background: "var(--color-input)",
            color: "var(--color-ink)",
          }}
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {!ledger && (
        <div className="panel px-3 py-6 text-center text-sm text-[var(--color-muted)]">
          Open this page by clicking a ledger on the Profit &amp; Loss.
        </div>
      )}

      {q.isError && (
        <div
          className="rounded border p-4 text-sm"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          <div className="font-medium">Could not load entries</div>
          <div className="mt-1">{(q.error as Error)?.message}</div>
        </div>
      )}

      {q.isLoading && (
        <div className="panel h-[420px] animate-pulse bg-[var(--color-hover)] opacity-50" />
      )}

      {q.data && (
        <EntriesTable
          rows={q.data.entries}
          total={q.data.total}
          netAmount={net}
          offset={offset}
          pageSize={pageSize}
          isFetching={q.isFetching}
          hasMore={q.data.has_more}
          onPrev={() => setOffset((o) => Math.max(0, o - pageSize))}
          onNext={() => setOffset((o) => o + pageSize)}
          emptyText="No entries behind this figure for the selected period."
        />
      )}
    </main>
  );
}

export default function Page() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-10 py-6">
          <div className="panel h-[420px] animate-pulse bg-[var(--color-hover)] opacity-50" />
        </main>
      }
    >
      <Entries />
    </Suspense>
  );
}
