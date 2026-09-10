"use client";

import { fmt, fmtPct, type Kpis } from "@/lib/api";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

function getTrend(current: number, past: number, invertColors = false) {
  if (!past || past === 0) return null;
  const pct = ((current - past) / Math.abs(past)) * 100;
  if (Math.abs(pct) < 0.1) return null;

  const isUp = pct > 0;
  const isFavorable = invertColors ? !isUp : isUp;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return {
    text: `${Math.abs(pct).toFixed(1)}%`,
    Icon,
    color: isFavorable ? "var(--positive)" : "var(--negative)",
    bg: isFavorable ? "#dcfce7" : "#fee2e2",
  };
}

const TILES = [
  {
    key: "revenue" as const,
    label: "Revenue",
    iconBg: "#dcfce7",
    iconColor: "#16a34a",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    key: "gross_profit" as const,
    label: "Gross Profit",
    marginKey: "gross_margin_pct" as const,
    iconBg: "#dbeafe",
    iconColor: "#2563eb",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    key: "operating_expenses" as const,
    label: "Operating Expenses",
    invertColors: true,
    iconBg: "#fee2e2",
    iconColor: "#dc2626",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
  {
    key: "net_income" as const,
    label: "Net Income",
    marginKey: "net_margin_pct" as const,
    iconBg: "#f3e8ff",
    iconColor: "#9333ea",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
];

export default function KpiStrip({
  current,
  comparison,
}: {
  current: Kpis;
  comparison?: Kpis | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {TILES.map((t) => {
        const currentVal = current[t.key];
        const compVal = comparison ? comparison[t.key] : undefined;
        const trend =
          compVal !== undefined
            ? getTrend(currentVal, compVal, t.invertColors)
            : null;
        const marginPct = t.marginKey ? current[t.marginKey] : undefined;
        const isNegative = currentVal < 0;

        return (
          <div
            key={t.label}
            className="panel p-5 hover:-translate-y-[2px] hover:shadow-lg transition-all duration-150 cursor-default"
          >
            {/* Header row: label + icon */}
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t.label}
              </span>
              <span
                className="rounded-xl p-2 flex items-center justify-center flex-shrink-0"
                style={{ background: t.iconBg, color: t.iconColor }}
              >
                {t.icon}
              </span>
            </div>

            {/* Main value */}
            <div
              className="text-2xl font-bold tracking-tight font-variant-numeric: tabular-nums"
              style={{ color: isNegative ? "var(--negative)" : "var(--color-ink)" }}
            >
              {fmt(currentVal)}
            </div>

            {/* Trend badge + margin */}
            <div className="mt-2 flex items-center gap-2 flex-wrap min-h-[20px]">
              {trend && (
                <span
                  className="inline-flex items-center text-xs font-semibold gap-0.5 px-1.5 py-0.5 rounded-full"
                  style={{ color: trend.color, background: trend.bg }}
                >
                  <trend.Icon className="h-3 w-3" />
                  {trend.text}
                  <span className="ml-1 font-normal opacity-75">vs prior year</span>
                </span>
              )}
              {marginPct !== undefined && (
                <span className="text-xs text-[var(--color-muted)]">
                  {fmtPct(marginPct)} margin
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
