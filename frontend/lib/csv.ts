/**
 * Converts an array of flat objects to a CSV file and triggers a browser download.
 */
export function toCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    const s = val === null || val === undefined ? "" : String(val);
    // Wrap in quotes if it contains commas, quotes, or newlines
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
