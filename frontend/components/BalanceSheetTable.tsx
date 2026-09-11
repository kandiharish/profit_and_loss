"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fmt, type BalanceSheet } from "@/lib/api";

/**
 * The balance sheet grid.
 *
 * Same two levels as the P&L: Section, expanding to its ledgers.
 *
 * Assets arrive already sign-flipped from the server (ledger amounts are
 * credit - debit, so debit-normal assets are negative in the raw data). The
 * flip happens once, server-side, so nothing here re-derives it.
 */
export default function BalanceSheetTable({ data }: { data: BalanceSheet }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const subtotalsAfter = (key: string) =>
    data.subtotals.filter((s) => s.after === key);

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--color-muted)" }}
          >
            <th className="sticky top-0 z-10 bg-[var(--color-card)] px-3 py-2 text-left font-medium">
              Account
            </th>
            <th className="sticky top-0 z-10 bg-[var(--color-card)] px-3 py-2 text-right font-medium">
              As at {data.as_of}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.sections.map((section) => {
            const isOpen = open[section.key] ?? false;
            return (
              <Fragment key={section.key}>
                <tr
                  className="cursor-pointer border-t font-medium hover:bg-[var(--color-hover)]"
                  style={{ borderColor: "var(--color-line)" }}
                  onClick={() =>
                    setOpen((o) => ({ ...o, [section.key]: !isOpen }))
                  }
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {isOpen ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      {section.label}
                      <span className="text-xs font-normal text-[var(--color-muted)]">
                        ({section.ledgers.length})
                      </span>
                    </span>
                  </td>
                  <td className="num px-3 py-2">{fmt(section.total)}</td>
                </tr>

                {isOpen &&
                  section.ledgers.map((l) => (
                    <tr
                      key={l.ledger_name}
                      className="border-t"
                      style={{ borderColor: "var(--color-line)" }}
                    >
                      <td className="px-3 py-1.5 pl-9">
                        {l.display_name}
                        {l.derived && (
                          <span
                            className="ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                            style={{
                              background: "var(--color-hover)",
                              color: "var(--color-muted)",
                            }}
                            title="Computed from the P&L, not a ledger account"
                          >
                            computed
                          </span>
                        )}
                      </td>
                      <td className="num px-3 py-1.5">{fmt(l.amount)}</td>
                    </tr>
                  ))}

                {subtotalsAfter(section.key).map((st) => (
                  <tr
                    key={st.key}
                    className="border-t-2 font-semibold"
                    style={{
                      borderColor: "var(--color-line)",
                      background: "var(--color-card)",
                    }}
                  >
                    <td className="px-3 py-2">{st.label}</td>
                    <td className="num px-3 py-2">{fmt(st.amount)}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Assets must equal liabilities + equity. Anything else means rows
          were dropped or double counted, so it is stated, not hidden. */}
      <div
        className="flex items-center justify-between border-t px-3 py-2.5 text-xs"
        style={{ borderColor: "var(--color-line)" }}
      >
        <span style={{ color: "var(--color-muted)" }}>
          Assets − (Liabilities + Equity)
        </span>
        <span
          className="num font-medium"
          style={{
            color: data.checks.balanced ? "var(--accent)" : "var(--negative)",
          }}
        >
          {data.checks.balanced
            ? `Balanced — ${fmt(data.checks.difference)}`
            : `OUT OF BALANCE by ${fmt(data.checks.difference)}`}
        </span>
      </div>
    </div>
  );
}
