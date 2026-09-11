"use client";

import { fmt, type LedgerEntry } from "@/lib/api";

/**
 * The GL line table, shared by the Ledger Entries tab and the P&L drill-down
 * page so the two can never drift apart.
 *
 * Columns are fixed, per spec:
 *
 *   Date | Company Name | Account Name | Section | Doc No. | Description | Amount
 *
 * Transaction Type, Name (counterparty) and Ledger are deliberately not
 * shown. They are still returned by the API and still searchable from the
 * Ledger Entries tab -- they are just not columns.
 *
 * The footer describes the WHOLE result set, not the page on screen: `total`
 * and `netAmount` come from a summary query run over the same filter as the
 * rows. On the drill-down page that net is the number that has to equal the
 * statement figure the user clicked.
 */
export default function EntriesTable({
  rows,
  total,
  netAmount,
  offset,
  pageSize,
  isFetching,
  hasMore,
  onPrev,
  onNext,
  emptyText = "No entries match this filter.",
}: {
  rows: LedgerEntry[];
  total: number;
  netAmount: number;
  offset: number;
  pageSize: number;
  isFetching: boolean;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  emptyText?: string;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + rows.length;
  const th =
    "sticky top-0 z-10 bg-[var(--color-card)] px-2 py-2 text-left font-medium";

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--color-muted)" }}
          >
            <th className={th}>Date</th>
            <th className={th}>Company Name</th>
            <th className={th}>Account Name</th>
            <th className={th}>Section</th>
            <th className={th}>Doc No.</th>
            <th className={th}>Description</th>
            <th className={`${th} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-2 py-6 text-center text-[var(--color-muted)]"
              >
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((e, i) => (
            <tr
              key={`${e.date}-${e.account_name}-${i}`}
              className="border-t hover:bg-[var(--color-hover)]"
              style={{ borderColor: "var(--color-line)" }}
            >
              <td className="whitespace-nowrap px-2 py-1.5">{e.date}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-[var(--color-muted)]">
                {e.company_name ?? ""}
              </td>
              {/* title carries the raw name, GL code included. */}
              <td className="px-2 py-1.5" title={e.account_name ?? ""}>
                {e.account ?? ""}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-[var(--color-muted)]">
                {e.section_label ?? ""}
              </td>
              <td className="px-2 py-1.5">{e.document_number ?? ""}</td>
              <td className="px-2 py-1.5 text-[var(--color-muted)]">
                {e.description ?? ""}
              </td>
              <td className="num px-2 py-1.5">{fmt(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2.5 text-xs"
        style={{ borderColor: "var(--color-line)" }}
      >
        <span style={{ color: "var(--color-muted)" }}>
          {from.toLocaleString()}&ndash;{to.toLocaleString()} of{" "}
          {total.toLocaleString()} entries &middot; total{" "}
          <span className="num font-medium text-[var(--color-ink)]">
            {fmt(netAmount)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <button
            disabled={offset === 0 || isFetching}
            onClick={onPrev}
            className="rounded border px-3 py-1 disabled:opacity-40"
            style={{ borderColor: "var(--color-line)" }}
          >
            Previous
          </button>
          <button
            disabled={!hasMore || isFetching}
            onClick={onNext}
            className="rounded border px-3 py-1 disabled:opacity-40"
            style={{ borderColor: "var(--color-line)" }}
          >
            Next
          </button>
        </span>
      </div>
    </div>
  );
}
