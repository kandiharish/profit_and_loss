export type Ledger = {
  /** Ledger group name from Conso_GL_Mapping. The drill-down key. */
  ledger_name: string;
  /** What the user sees. A ledger name carries no GL code to strip. */
  display_name: string;
  amount: number;
  txn_count: number;
  /** How many GL accounts roll up into this ledger. */
  account_count: number;
};

export type Section = {
  key: string;
  label: string;
  total: number;
  /** A section's children are LEDGER groups, not individual accounts.
   *  Accounts live one level down, behind the drill-down. */
  ledgers: Ledger[];
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
  /** Which GL account inside the ledger this line hit (GL code stripped). */
  account: string | null;
  /** Raw account name, including the GL code. */
  account_name: string | null;
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
  compareTo?: string,
  company?: string
): Promise<StatementResponse> {
  const q = new URLSearchParams({ start_date: start, end_date: end });
  if (company) q.set("company", company);
  if (department) q.set("department", department);
  if (compareTo) q.set("compare_to", compareTo);
  return get(`/api/pnl/statement?${q}`);
}

export function fetchDrilldown(
  start: string,
  end: string,
  ledgerName: string,
  department?: string,
  company?: string
) {
  const q = new URLSearchParams({
    start_date: start,
    end_date: end,
    ledger_name: ledgerName,
  });
  if (department) q.set("department", department);
  if (company) q.set("company", company);
  return get<{ ledger_name: string; lines: DrilldownLine[] }>(
    `/api/pnl/drilldown?${q}`
  );
}

export type TrendPoint = {
  period: string;
  pnl_section: string;
  amount: number;
};

export function fetchTrend(
  start: string,
  end: string,
  department?: string,
  company?: string
) {
  const q = new URLSearchParams({ start_date: start, end_date: end });
  if (department) q.set("department", department);
  if (company) q.set("company", company);
  return get<{ points: TrendPoint[] }>(`/api/pnl/trend?${q}`);
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

export type Company = {
  company_name: string;
  gl_rows: number;
  min_date: string;
  max_date: string;
};

export function fetchCompanies() {
  return get<{ companies: Company[] }>("/api/meta/companies");
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

/* ------------------------------------------------------------------ */
/* Balance sheet                                                       */
/* ------------------------------------------------------------------ */

export type BsLedger = Ledger & {
  /** Net Income / Unclassified are computed, not ledger rows. */
  derived?: boolean;
};

export type BsSection = {
  key: string;
  label: string;
  total: number;
  ledgers: BsLedger[];
};

export type BsSubtotal = {
  key: string;
  label: string;
  after: string;
  amount: number;
};

export type BalanceSheet = {
  as_of: string;
  department: string | null;
  sections: BsSection[];
  subtotals: BsSubtotal[];
  checks: {
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    liabilities_and_equity: number;
    difference: number;
    balanced: boolean;
  };
};

/**
 * A balance sheet is a position, not a period, so only the as-at date is
 * sent. The From filter is deliberately ignored on this tab.
 */
export function fetchBalanceSheet(
  asOf: string,
  department?: string,
  company?: string
) {
  const q = new URLSearchParams({ as_of: asOf });
  if (department) q.set("department", department);
  if (company) q.set("company", company);
  return get<BalanceSheet>(`/api/bs/statement?${q}`);
}

/* ------------------------------------------------------------------ */
/* Ledger entries                                                      */
/* ------------------------------------------------------------------ */

export type LedgerEntry = {
  date: string;
  company_name: string | null;
  account: string | null;
  account_name: string | null;
  statement_label: string | null;
  section_label: string | null;
  ledger_name: string | null;
  transaction_type: string | null;
  document_number: string | null;
  counterparty: string | null;
  description: string | null;
  split_account: string | null;
  department: string | null;
  amount: number;
};

export type LedgerEntriesResponse = {
  entries: LedgerEntry[];
  /** Across the whole filter, not just the page on screen. */
  total: number;
  net_amount: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export function fetchLedgerEntries(
  start: string,
  end: string,
  opts: {
    department?: string;
    company?: string;
    statement?: string;
    /** Restrict to one ledger group. */
    ledgerName?: string;
    /** Apply the P&L's own section gate so totals tie to the statement. */
    pnlOnly?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const q = new URLSearchParams({ start_date: start, end_date: end });
  if (opts.department) q.set("department", opts.department);
  if (opts.company) q.set("company", opts.company);
  if (opts.statement) q.set("statement", opts.statement);
  if (opts.ledgerName) q.set("ledger_name", opts.ledgerName);
  if (opts.pnlOnly) q.set("pnl_only", "true");
  if (opts.search) q.set("search", opts.search);
  q.set("limit", String(opts.limit ?? 200));
  q.set("offset", String(opts.offset ?? 0));
  return get<LedgerEntriesResponse>(`/api/ledger/entries?${q}`);
}
