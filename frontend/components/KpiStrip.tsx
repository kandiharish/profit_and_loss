"use client";

import { fmt, fmtPct, type Kpis } from "@/lib/api";

export default function KpiStrip({ kpis }: { kpis: Kpis }) {
  const tiles = [
    { label: "Revenue", value: fmt(kpis.revenue) },
    {
      label: "Gross Profit",
      value: fmt(kpis.gross_profit),
      sub: `${fmtPct(kpis.gross_margin_pct)} margin`,
    },
    { label: "Operating Expenses", value: fmt(kpis.operating_expenses) },
    {
      label: "Net Income",
      value: fmt(kpis.net_income),
      sub: `${fmtPct(kpis.net_margin_pct)} margin`,
      negative: kpis.net_income < 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {t.label}
          </div>
          <div
            className="num mt-1 text-2xl font-semibold"
            style={{ color: t.negative ? "var(--negative)" : "var(--text)" }}
          >
            {t.value}
          </div>
          {t.sub && <div className="mt-0.5 text-xs text-[var(--muted)]">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}
