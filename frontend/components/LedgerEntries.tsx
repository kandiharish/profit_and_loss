"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import EntriesTable from "@/components/EntriesTable";
import { fetchLedgerEntries } from "@/lib/api";

const PAGE = 200;

/**
 * Raw GL lines for the selected period.
 *
 * The footer counts and nets the WHOLE filter, not the page on screen, so
 * "29,731 entries" means what it says. Paging keeps the previous page
 * mounted (placeholderData) so the table does not blank out between fetches.
 */
export default function LedgerEntries({
  start,
  end,
  department,
  company,
}: {
  start: string;
  end: string;
  department?: string;
  company?: string;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statement, setStatement] = useState("");
  const [offset, setOffset] = useState(0);

  // Typing must not fire a BigQuery job per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setOffset(0);
  }, [debounced, statement, start, end, department, company]);

  const q = useQuery({
    queryKey: [
      "ledger", start, end, department, company, statement, debounced, offset,
    ],
    queryFn: () =>
      fetchLedgerEntries(start, end, {
        department,
        company,
        statement: statement || undefined,
        search: debounced || undefined,
        limit: PAGE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.entries ?? [];
  const total = q.data?.total ?? 0;

  const inputStyle = {
    borderColor: "var(--color-line)",
    background: "var(--color-input)",
    color: "var(--color-ink)",
  };

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account, ledger, name, description or doc no."
            className="w-full rounded border px-9 py-2 text-sm"
            style={inputStyle}
          />
        </div>
        <select
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
          style={inputStyle}
        >
          <option value="">All statements</option>
          <option value="Profit &amp; Loss">Profit &amp; Loss</option>
          <option value="Balance Sheet">Balance Sheet</option>
        </select>
      </div>

      {q.isError && (
        <div
          className="rounded border p-4 text-sm"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          <div className="font-medium">Could not load ledger entries</div>
          <div className="mt-1">{(q.error as Error)?.message}</div>
        </div>
      )}

      {q.isLoading && (
        <div className="panel h-[420px] animate-pulse bg-[var(--color-hover)] opacity-50" />
      )}

      {q.data && (
        <EntriesTable
          rows={rows}
          total={total}
          netAmount={q.data.net_amount}
          offset={offset}
          pageSize={PAGE}
          isFetching={q.isFetching}
          hasMore={q.data.has_more}
          onPrev={() => setOffset((o) => Math.max(0, o - PAGE))}
          onNext={() => setOffset((o) => o + PAGE)}
        />
      )}
    </div>
  );
}
