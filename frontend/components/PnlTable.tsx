"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
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
  /**
   * Builds the drill-down URL for a ledger. A real href rather than a click
   * handler, so a row can be middle-clicked, opened in a new tab and
   * deep-linked.
   */
  hrefFor?: (sectionKey: string, ledgerName: string, amount: number) => string;
};

/**
 * The statement grid.
 *
 * Two levels, per spec:
 *   - a SECTION row ("Operating Revenue") from Conso_GL_Mapping.Section
 *   - expanded, its LEDGER rows ("Inbound Handling Revenue") from
 *     Conso_GL_Mapping.Ledger_Name
 *
 * Individual GL accounts are deliberately not a row here -- they sit one
 * level further down, reached by clicking a ledger to drill in.
 *
 * Still omitted, per spec: no account sub-type column.
 */
export default function PnlTable({
  statement,
  comparison,
  comparisonLabel,
  hrefFor,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const showCompare = Boolean(comparison);

  // Match within the SAME section: Ledger_Name is not unique on its own --
  // "Rental Income - Non-Operating" exists under both Operating Revenue and
  // Other Income -- so searching across sections could pair a ledger with
  // the wrong prior-year figure.
  const priorLedger = (sectionKey: string, ledgerName: string) =>
    comparison?.sections
      .find((s) => s.key === sectionKey)
      ?.ledgers.find((l) => l.ledger_name === ledgerName)?.amount;
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
                  className="cursor-pointer border-t font-medium hover:bg-[var(--color-hover)]"
                  style={{ borderColor: "var(--color-line)" }}
                  onClick={() => setOpen((o) => ({ ...o, [section.key]: !isOpen }))}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {section.label}
                      <span className="text-xs font-normal text-[var(--color-muted)]">
                        ({section.ledgers.length})
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
                  section.ledgers.map((l) => (
                    <tr
                      key={l.ledger_name}
                      className="border-t hover:bg-[var(--color-hover)]"
                      style={{ borderColor: "var(--color-line)" }}
                    >
                      <td className="px-3 py-1.5 pl-9">
                        {hrefFor ? (
                          <Link
                            href={hrefFor(section.key, l.ledger_name, l.amount)}
                            className="text-left hover:underline"
                            style={{ color: "var(--link)" }}
                            title={`${l.account_count} account${
                              l.account_count === 1 ? "" : "s"
                            } — open every entry behind this figure`}
                          >
                            {l.display_name}
                          </Link>
                        ) : (
                          l.display_name
                        )}
                      </td>
                      <td className="num px-3 py-1.5">{fmt(l.amount)}</td>
                      {showCompare && (
                        <>
                          <td className="num px-3 py-1.5 text-[var(--color-muted)]">
                            {fmt(priorLedger(section.key, l.ledger_name))}
                          </td>
                          {/* Ledgers inherit their section's nature. */}
                          <Delta
                            now={l.amount}
                            then={priorLedger(section.key, l.ledger_name)}
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
