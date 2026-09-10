"use client";

import { Download, Image as ImageIcon, ZoomIn, ZoomOut, Maximize, RefreshCw } from "lucide-react";
import { toCsv } from "@/lib/csv";
import { type Statement } from "@/lib/api";

export default function ChartToolbar({ statement, filename }: { statement: Statement; filename: string }) {
  const handleCsvDownload = () => {
    // Flatten statement into rows for CSV
    const rows: Record<string, any>[] = [];
    statement.sections.forEach(section => {
      section.accounts.forEach(account => {
        rows.push({
          Section: section.label,
          Account: account.display_name,
          Amount: account.amount,
          "Transaction Count": account.txn_count
        });
      });
    });
    toCsv(rows, filename);
  };

  const btnCls = "p-1.5 hover:bg-[var(--color-page)] rounded text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors";

  return (
    <div className="flex items-center gap-1 border-b border-[var(--color-line)] pb-2 mb-4">
      <button className={btnCls} onClick={handleCsvDownload} title="Download CSV">
        <Download size={16} />
      </button>
      <button className={btnCls} title="Download PNG (Coming Soon)">
        <ImageIcon size={16} />
      </button>
      <div className="w-px h-4 bg-[var(--color-line)] mx-1" />
      <button className={btnCls} title="Zoom Out">
        <ZoomOut size={16} />
      </button>
      <button className={btnCls} title="Zoom In">
        <ZoomIn size={16} />
      </button>
      <div className="w-px h-4 bg-[var(--color-line)] mx-1" />
      <button className={btnCls} title="Fullscreen">
        <Maximize size={16} />
      </button>
      <button className={btnCls} title="Reset View">
        <RefreshCw size={16} />
      </button>
    </div>
  );
}
