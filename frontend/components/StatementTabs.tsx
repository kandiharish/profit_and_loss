"use client";

import { BarChart3, BookOpen, Scale } from "lucide-react";

export type TabKey = "balance_sheet" | "pnl" | "ledger";

export const TABS: { key: TabKey; label: string; icon: typeof Scale }[] = [
  { key: "balance_sheet", label: "Balance Sheet", icon: Scale },
  { key: "pnl", label: "Profit & Loss", icon: BarChart3 },
  { key: "ledger", label: "Ledger Entries", icon: BookOpen },
];

/**
 * Statement switcher. Sits in the header row, beside the title.
 *
 * role="tablist" with roving aria-selected rather than a row of buttons, so
 * a screen reader announces "tab 2 of 3" instead of three unrelated
 * controls.
 */
export default function StatementTabs({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Statement"
      className="inline-flex items-center gap-1 rounded p-1"
      style={{ background: "var(--color-hover)" }}
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
            style={
              isActive
                ? {
                    background: "var(--color-card)",
                    color: "var(--color-ink)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                  }
                : { color: "var(--color-muted)" }
            }
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
