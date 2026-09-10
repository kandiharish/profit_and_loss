"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { type StatementResponse, type TrendPoint } from "@/lib/api";
import { Download } from "lucide-react";

const COLORS = ["#ef4444", "#22d3ee", "#3b82f6", "#8b5cf6", "#d946ef", "#f97316", "#eab308"];
const COLOR_LABELS = ["Amortization Expense", "Depreciation Expense", "Interest Expense", "Professional Fees", "Purchase for resale", "State Taxes", "State Taxes - Property"];

function formatAmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function downloadCSV(data: ReturnType<typeof transformTrend>, filename: string) {
  if (!data.length) return;
  const headers = ["Period", "Revenue", "Expenses", "Profit"];
  const rows = data.map(d => [d.period, d.Revenue, d.Expenses, d.Profit]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function transformTrend(trendData: TrendPoint[]) {
  const grouped = new Map<string, { period: string; Revenue: number; Expenses: number; Profit: number }>();
  for (const pt of trendData) {
    if (!grouped.has(pt.period)) {
      grouped.set(pt.period, { period: pt.period, Revenue: 0, Expenses: 0, Profit: 0 });
    }
    const entry = grouped.get(pt.period)!;
    if (pt.pnl_section === "revenue" || pt.pnl_section === "other_income") {
      entry.Revenue += pt.amount;
    } else if (pt.pnl_section === "opex" || pt.pnl_section === "cogs" || pt.pnl_section === "other_expense") {
      entry.Expenses += Math.abs(pt.amount);
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(entry => ({
      ...entry,
      Profit: entry.Revenue - entry.Expenses,
      displayDate: new Date(entry.period + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    }));
}

export default function PnlCharts({
  trendData,
  statementData,
}: {
  trendData: TrendPoint[];
  statementData: StatementResponse;
}) {
  const [csvToast, setCsvToast] = useState(false);

  const lineData = useMemo(() => transformTrend(trendData), [trendData]);

  const donutData = useMemo(() => {
    if (!statementData?.current) return [];
    let expensesSection = statementData.current.sections.find(s => s.key === "opex");
    if (!expensesSection) {
      expensesSection = statementData.current.sections.find(s => s.label.toLowerCase().includes("expense"));
    }
    if (!expensesSection) return [];
    return expensesSection.accounts
      .filter(a => Math.abs(a.amount) > 0)
      .map(a => ({ name: a.display_name, value: Math.abs(a.amount) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [statementData]);

  const totalExpenses = donutData.reduce((s, d) => s + d.value, 0);

  const handleCsvDownload = () => {
    downloadCSV(lineData, "profit_trend.csv");
    setCsvToast(true);
    setTimeout(() => setCsvToast(false), 2500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
      {/* Profit Trend */}
      <div className="panel p-5 lg:col-span-2 hover:-translate-y-[1px] transition-all duration-150">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: "#dbeafe", color: "#2563eb" }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <span className="font-semibold text-sm text-[var(--color-ink)]">Profit Trend</span>
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-0.5 ml-8">Revenue, expenses and profit over time</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCsvDownload}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:bg-[var(--color-input)] transition-colors duration-150"
              style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
              title="Download CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            {csvToast && (
              <span className="text-xs text-[var(--positive)] font-medium animate-in fade-in duration-200">
                ✓ Downloaded
              </span>
            )}
          </div>
        </div>

        <div className="h-[300px] w-full mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
              <XAxis
                dataKey="displayDate"
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                domain={["auto", "auto"]}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15,23,42,0.92)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  padding: "10px 14px",
                }}
                itemStyle={{ color: "#e2e8f0", fontSize: 12 }}
                labelStyle={{ color: "#94a3b8", fontSize: 11, marginBottom: "6px" }}
                formatter={(value: number) => [`$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, undefined]}
              />
              {/* Custom legend */}
              <Line type="monotone" dataKey="Revenue" name="Revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: "#10b981" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 2, fill: "#ef4444" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Profit" name="Profit" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 2, fill: "#0f172a" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inline legend */}
        <div className="flex items-center gap-5 mt-2 ml-1">
          {[
            { label: "Expenses", color: "#ef4444" },
            { label: "Profit", color: "#0f172a" },
            { label: "Revenue", color: "#10b981" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              <span className="inline-block w-6 h-0.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="panel p-5 hover:-translate-y-[1px] transition-all duration-150">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg" style={{ background: "#fee2e2", color: "#dc2626" }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-[var(--color-ink)]">Expense Breakdown</span>
        </div>

        {donutData.length > 0 ? (
          <>
            {/* Donut chart */}
            <div className="relative h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15,23,42,0.92)",
                      backdropFilter: "blur(8px)",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "8px 12px",
                    }}
                    itemStyle={{ color: "#e2e8f0", fontSize: 12 }}
                    formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, undefined]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-[var(--color-ink)]">{formatAmt(totalExpenses)}</span>
                <span className="text-[10px] text-[var(--color-muted)] mt-0.5">Total Expenses</span>
              </div>
            </div>

            {/* Custom legend rows */}
            <div className="mt-3 space-y-2">
              {donutData.map((d, i) => {
                const pct = totalExpenses > 0 ? ((d.value / totalExpenses) * 100).toFixed(1) : "0.0";
                return (
                  <div key={d.name} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-[var(--color-muted)] truncate">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-semibold text-[var(--color-ink)]">{formatAmt(d.value)}</span>
                      <span className="text-[var(--color-muted)] w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-sm text-[var(--color-muted)]">
            No expense data available
          </div>
        )}
      </div>
    </div>
  );
}
