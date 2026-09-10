"use client";

import { useQuery } from "@tanstack/react-query";
import { fmt, fmtPct } from "@/lib/api";
import { Building2, TrendingUp, TrendingDown, Minus } from "lucide-react";

type PropertyRow = {
  department: string;
  department_display: string;
  revenue: number;
  gross_profit: number;
  gross_margin_pct: number | null;
  operating_expenses: number;
  net_income: number;
  net_margin_pct: number | null;
};

async function fetchByProperty(start: string, end: string) {
  const q = new URLSearchParams({ start_date: start, end_date: end });
  const res = await fetch(`/api/pnl/by-property?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load property breakdown");
  return res.json() as Promise<{ properties: PropertyRow[] }>;
}

function NetBadge({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--positive)" }}>
        <TrendingUp className="h-3 w-3" /> Profit
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--negative)" }}>
        <TrendingDown className="h-3 w-3" /> Loss
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-muted)]">
      <Minus className="h-3 w-3" /> Break even
    </span>
  );
}

export default function PropertyBreakdown({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["by-property", start, end],
    queryFn: () => fetchByProperty(start, end),
  });

  const cols = [
    { key: "revenue", label: "Revenue" },
    { key: "gross_profit", label: "Gross Profit" },
    { key: "operating_expenses", label: "OpEx" },
    { key: "net_income", label: "Net Income" },
  ] as const;

  return (
    <div className="panel mt-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: "var(--color-line)" }}>
        <div className="p-1.5 rounded-lg" style={{ background: "#f3e8ff", color: "#9333ea" }}>
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-[var(--color-ink)]">By-Property Performance</h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">Net income breakdown across all properties</p>
        </div>
      </div>

      {/* Body */}
      {isLoading && (
        <div className="animate-pulse px-5 py-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-[var(--color-input)] opacity-60" />
          ))}
        </div>
      )}

      {isError && (
        <div className="px-5 py-4 text-sm" style={{ color: "var(--negative)" }}>
          {(error as Error).message}
        </div>
      )}

      {data && data.properties.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-line)" }}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Property
                </th>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Margin
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.properties.map((row, i) => {
                const isProfit = row.net_income > 0;
                const isLoss = row.net_income < 0;
                return (
                  <tr
                    key={row.department}
                    className="transition-colors duration-100"
                    style={{
                      borderBottom: i < data.properties.length - 1 ? "1px solid var(--color-line)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--color-input)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: isProfit ? "var(--positive)" : isLoss ? "var(--negative)" : "var(--color-muted)" }}
                        />
                        <span className="font-medium text-[var(--color-ink)]">{row.department_display}</span>
                      </div>
                    </td>
                    <td className="num px-4 py-3.5 text-[var(--color-ink)]">{fmt(row.revenue)}</td>
                    <td className="num px-4 py-3.5 text-[var(--color-ink)]">{fmt(row.gross_profit)}</td>
                    <td
                      className="num px-4 py-3.5"
                      style={{ color: row.operating_expenses < 0 ? "var(--negative)" : "var(--color-ink)" }}
                    >
                      {fmt(row.operating_expenses)}
                    </td>
                    <td
                      className="num px-4 py-3.5 font-semibold"
                      style={{ color: isProfit ? "var(--positive)" : isLoss ? "var(--negative)" : "var(--color-ink)" }}
                    >
                      {fmt(row.net_income)}
                    </td>
                    <td className="num px-5 py-3.5 text-[var(--color-muted)]">
                      {fmtPct(row.net_margin_pct)}
                    </td>
                    <td className="px-5 py-3.5">
                      <NetBadge value={row.net_income} />
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Summary footer */}
            {data.properties.length > 1 && (() => {
              const totalRevenue = data.properties.reduce((s, r) => s + r.revenue, 0);
              const totalNet = data.properties.reduce((s, r) => s + r.net_income, 0);
              const totalOpex = data.properties.reduce((s, r) => s + r.operating_expenses, 0);
              const totalGross = data.properties.reduce((s, r) => s + r.gross_profit, 0);
              const avgMargin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : null;
              return (
                <tfoot>
                  <tr
                    className="text-xs font-semibold"
                    style={{ borderTop: "2px solid var(--color-line)", background: "var(--color-input)" }}
                  >
                    <td className="px-5 py-3 text-[var(--color-muted)] uppercase tracking-wider">
                      Total ({data.properties.length} properties)
                    </td>
                    <td className="num px-4 py-3 text-[var(--color-ink)]">{fmt(totalRevenue)}</td>
                    <td className="num px-4 py-3 text-[var(--color-ink)]">{fmt(totalGross)}</td>
                    <td className="num px-4 py-3 text-[var(--color-ink)]">{fmt(totalOpex)}</td>
                    <td
                      className="num px-4 py-3 font-bold"
                      style={{ color: totalNet >= 0 ? "var(--positive)" : "var(--negative)" }}
                    >
                      {fmt(totalNet)}
                    </td>
                    <td className="num px-5 py-3 text-[var(--color-muted)]">{fmtPct(avgMargin)}</td>
                    <td className="px-5 py-3">
                      <NetBadge value={totalNet} />
                    </td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      )}

      {data && data.properties.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
          No property data available for the selected period.
        </div>
      )}
    </div>
  );
}
