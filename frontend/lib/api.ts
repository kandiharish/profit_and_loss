export type Account = {
  /** Raw name including the GL code. Used as the drill-down key, never shown. */
  account_name: string;
  /** GL code stripped -- this is what the user sees. */
  display_name: string;
  amount: number;
  txn_count: number;
};

export type Section = {
  key: string;
  label: string;
  total: number;
  accounts: Account[];
};

export type Subtotal = {
  key: string;
  label: string;
  after: string;
  amount: number;
};

export type Kpis = {
  revenue: number;
  gross_profit: number;
  gross_margin_pct: number | null;
  operating_expenses: number;
  net_income: number;
  net_margin_pct: number | null;
};

export type Statement = {
  sections: Section[];
  subtotals: Subtotal[];
  kpis: Kpis;
};

export type StatementResponse = {
  period: { start: string; end: string };
  department: string | null;
  current: Statement;
  comparison: (Statement & { basis: string }) | null;
};

export type DrilldownLine = {
  date: string;
  transaction_type: string | null;
  document_number: string | null;
  counterparty: string | null;
  description: string | null;
  split_account: string | null;
  department: string | null;
  amount: number;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.hint || body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export function fetchStatement(
  start: string,
  end: string,
  department?: string,
  compareTo?: string
): Promise<StatementResponse> {
  const q = new URLSearchParams({ start_date: start, end_date: end });
  if (department) q.set("department", department);
  if (compareTo) q.set("compare_to", compareTo);
  return get(`/api/pnl/statement?${q}`);
}

export function fetchDrilldown(
  start: string,
  end: string,
  accountName: string,
  department?: string
) {
  const q = new URLSearchParams({
    start_date: start,
    end_date: end,
    account_name: accountName,
  });
  if (department) q.set("department", department);
  return get<{ account_name: string; lines: DrilldownLine[] }>(
    `/api/pnl/drilldown?${q}`
  );
}

export type Department = {
  /** Raw value — the filter key. Amounts never merge across two of these. */
  department: string;
  /**
   * Numeric prefix stripped. Where two entities would collide, the prefix is
   * appended instead: "Sherman (1650)" vs "Sherman (850)".
   */
  department_display: string;
  gl_rows: number;
  disambiguated: boolean;
};

export function fetchDepartments() {
  return get<{ departments: Department[] }>("/api/meta/departments");
}

export function fetchDateRange() {
  return get<{ min_date: string; max_date: string; row_count: number }>(
    "/api/meta/date-range"
  );
}

/** Accounting convention: negatives in parentheses, never a minus sign. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(${abs})` : abs;
}

export function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${n.toFixed(1)}%`;
}
