"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fmt, type Statement, type Subtotal } from "@/lib/api";
import {
  formatVariance,
  isExpenseSection,
  isFavourable,
  variancePct,
} from "@/lib/variance";

type Props = {
  statement: Statement;
  comparison?: Statement | null;
  comparisonLabel?: string;
  onDrilldown?: (rawAccountName: string) => void;
};

/**
 * The statement grid.
 *
 * Two deliberate omissions, per spec:
 *   - no account sub-type column
 *   - account names show WITHOUT their GL code (display_name), while
 *     account_name (with the code) is kept as the drill-down key
 */
export default function PnlTable({
  statement,
  comparison,
  comparisonLabel,
  onDrilldown,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const showCompare = Boolean(comparison);

  // Match on the raw name: display names could collide once codes are
  // stripped, raw names cannot.
  const priorAccount = (rawName: string) => {
    if (!comparison) return undefined;
    for (const s of comparison.sections) {
      const hit = s.accounts.find((a) => a.account_name === rawName);
      if (hit) return hit.amount;
    }
    return undefined;
  };
  const priorSection = (key: string) =>
    comparison?.sections.find((s) => s.key === key)?.total;
  const priorSubtotal = (key: string) =>
    comparison?.subtotals.find((s) => s.key === key)?.amount;

  /**
   * `isExpense` states the variance in expense terms, so Operating Expenses
   * rising from (1,974,357.92) to (3,694,294.11) reads +87.1%, not -87.1%.
   * Subtotals (Gross Profit, Net Income) are profit measures and keep the
   * plain signed reading.
   */
  const Delta = ({
    now,
    then,
    isExpense = false,
  }: {
    now: number;
    then?: number;
    isExpense?: boolean;
  }) => {
    const pct = variancePct(now, then, isExpense);
    if (pct === null)
      return <td className="num px-3 py-1.5 text-xs text-[var(--color-muted)]">—</td>;
    return (
      <td
        className="num px-3 py-1.5 text-xs"
        style={{
          color: isFavourable(pct, isExpense)
            ? "var(--accent)"
            : "var(--negative)",
        }}
      >
        {formatVariance(pct)}
      </td>
    );
  };

  const subtotalsAfter = (key: string): Subtotal[] =>
    statement.subtotals.filter((s) => s.after === key);

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--color-muted)" }}
          >
            <th className="sticky top-0 z-10 bg-[var(--color-card)] px-3 py-2 text-left font-medium">Account</th>
            <th className="sticky top-0 z-10 bg-[var(--color-card)] px-3 py-2 text-right font-medium">Amount</th>
            {showCompare && (
              <>
                <th className="sticky top-0 z-10 bg-[var(--color-card)] px-3 py-2 text-right font-medium">
                  {comparisonLabel ?? "Prior"}
                </th>
                <th className="sticky top-0 z-10 bg-[var(--color-card)] px-3 py-2 text-right font-medium">Δ</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {statement.sections.map((section) => {
            const isOpen = open[section.key] ?? false;
            return (
              <Fragment key={section.key}>
                <tr
                  className="cursor-pointer border-t font-medium hover:bg-[var(--color-card)]"
                  style={{ borderColor: "var(--color-line)" }}
                  onClick={() => setOpen((o) => ({ ...o, [section.key]: !isOpen }))}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {section.label}
                      <span className="text-xs font-normal text-[var(--color-muted)]">
                        ({section.accounts.length})
                      </span>
                    </span>
                  </td>
                  <td className="num px-3 py-2">{fmt(section.total)}</td>
                  {showCompare && (
                    <>
                      <td className="num px-3 py-2 text-[var(--color-muted)]">
                        {fmt(priorSection(section.key))}
                      </td>
                      <Delta
                        now={section.total}
                        then={priorSection(section.key)}
                        isExpense={isExpenseSection(section.key)}
                      />
                    </>
                  )}
                </tr>

                {isOpen &&
                  section.accounts.map((a) => (
                    <tr
                      key={a.account_name}
                      className="border-t hover:bg-[var(--color-card)]"
                      style={{ borderColor: "var(--color-line)" }}
                    >
                      <td className="px-3 py-1.5 pl-9">
                        <button
                          className="text-left hover:underline"
                          onClick={() => onDrilldown?.(a.account_name)}
                          title={a.account_name}
                        >
                          {a.display_name}
                        </button>
                      </td>
                      <td className="num px-3 py-1.5">{fmt(a.amount)}</td>
                      {showCompare && (
                        <>
                          <td className="num px-3 py-1.5 text-[var(--color-muted)]">
                            {fmt(priorAccount(a.account_name))}
                          </td>
                          {/* Accounts inherit their section's nature. */}
                          <Delta
                            now={a.amount}
                            then={priorAccount(a.account_name)}
                            isExpense={isExpenseSection(section.key)}
                          />
                        </>
                      )}
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
                    {showCompare && (
                      <>
                        <td className="num px-3 py-2 text-[var(--color-muted)]">
                          {fmt(priorSubtotal(st.key))}
                        </td>
                        <Delta now={st.amount} then={priorSubtotal(st.key)} />
                      </>
                    )}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
