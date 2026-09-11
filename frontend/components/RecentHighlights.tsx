"use client";

import { type Kpis } from "@/lib/api";
import { TrendingUp, TrendingDown, Award, ShieldCheck } from "lucide-react";

function pctChange(current: number, past: number) {
  if (!past || past === 0) return null;
  return ((current - past) / Math.abs(past)) * 100;
}

export default function RecentHighlights({
  current,
  comparison,
}: {
  current: Kpis;
  comparison: Kpis;
}) {
  const revPct = pctChange(current.revenue, comparison.revenue);
  const netPct = pctChange(current.net_income, comparison.net_income);
  const expPct = pctChange(current.operating_expenses, comparison.operating_expenses);
  const margin = current.net_margin_pct;

  const highlights = [
    {
      icon: TrendingUp,
      iconBg: revPct !== null && revPct >= 0 ? "var(--tint-green)" : "var(--tint-red)",
      iconColor: revPct !== null && revPct >= 0 ? "var(--tint-green-ink)" : "var(--tint-red-ink)",
      title: revPct !== null && revPct >= 0 ? "Revenue Increased" : "Revenue Decreased",
      description:
        revPct !== null
          ? `${revPct >= 0 ? "Up" : "Down"} ${Math.abs(revPct).toFixed(1)}% compared to prior year`
          : "Revenue data available",
      positive: revPct !== null && revPct >= 0,
    },
    {
      icon: TrendingDown,
      iconBg: netPct !== null && netPct >= 0 ? "var(--tint-green)" : "var(--tint-red)",
      iconColor: netPct !== null && netPct >= 0 ? "var(--tint-green-ink)" : "var(--tint-red-ink)",
      title: netPct !== null && netPct >= 0 ? "Net Income Increased" : "Net Income Decreased",
      description:
        netPct !== null
          ? `${netPct >= 0 ? "Up" : "Down"} ${Math.abs(netPct).toFixed(1)}% compared to prior year`
          : "Net income data available",
      positive: netPct !== null && netPct >= 0,
    },
    {
      icon: Award,
      iconBg: "var(--tint-blue)",
      iconColor: "var(--tint-blue-ink)",
      title: margin !== null && margin > 80 ? "High Margin" : margin !== null && margin > 50 ? "Good Margin" : "Margin Insight",
      description:
        margin !== null
          ? `${margin.toFixed(1)}% net income margin`
          : "Margin data available",
      positive: true,
    },
    {
      icon: ShieldCheck,
      iconBg: expPct !== null && expPct <= 0 ? "var(--tint-green)" : "var(--tint-amber)",
      iconColor: expPct !== null && expPct <= 0 ? "var(--tint-green-ink)" : "var(--tint-amber-ink)",
      title: expPct !== null && expPct <= 0 ? "Expense Control" : "Expenses Up",
      description:
        expPct !== null
          ? `Operating expenses ${expPct <= 0 ? "down" : "up"} ${Math.abs(expPct).toFixed(1)}%`
          : "Expense data available",
      positive: expPct !== null && expPct <= 0,
    },
  ];

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span className="text-sm font-semibold text-[var(--color-ink)]">Recent Highlights</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {highlights.map((h) => {
          const Icon = h.icon;
          return (
            <div
              key={h.title}
              className="panel p-4 hover:-translate-y-[1px] hover:shadow-lg transition-all duration-150 cursor-default"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="flex items-center justify-center w-8 h-8 rounded flex-shrink-0"
                  style={{ background: h.iconBg, color: h.iconColor }}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: h.positive ? "var(--positive)" : "var(--negative)" }}
                >
                  {h.title}
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">{h.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
