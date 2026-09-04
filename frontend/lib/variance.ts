/**
 * Period-over-period variance, expressed the way a reader expects.
 *
 * Amounts are stored credit-positive, so expenses are NEGATIVE numbers.
 * A raw variance on those reads backwards: Operating Expenses growing from
 * (1,974,357.92) to (3,694,294.11) is a real INCREASE of 87.1%, but the
 * arithmetic on the signed values gives −87.1%.
 *
 * So for expense lines the variance is negated — stated in expense terms,
 * where "up" means "we spent more".
 *
 *   raw    = (now - then) / |then|
 *   expense = -raw
 *
 * Negating (rather than comparing magnitudes) also stays correct when an
 * account flips sign: an expense of 100 that becomes a net credit of 50 is
 * a 150% decrease, which -raw gives and |now|-|then| would not.
 *
 * The underlying amounts are untouched — this is display only.
 */

/** P&L sections whose amounts are costs. */
export const EXPENSE_SECTIONS = new Set(["cogs", "opex", "other_expense"]);

export function isExpenseSection(sectionKey: string): boolean {
  return EXPENSE_SECTIONS.has(sectionKey);
}

/**
 * Variance as a percentage, or null when there is no meaningful base.
 * `isExpense` flips the sign so an increase in spend reads positive.
 */
export function variancePct(
  now: number,
  then: number | undefined | null,
  isExpense: boolean
): number | null {
  if (then === undefined || then === null || then === 0) return null;
  if (!Number.isFinite(now) || !Number.isFinite(then)) return null;
  const raw = ((now - then) / Math.abs(then)) * 100;
  return isExpense ? -raw : raw;
}

/**
 * Is this movement good news?
 *
 * Income and profit rising is favourable; expenses rising is not. Without
 * this, an 87% jump in Operating Expenses would render in the same colour
 * as an 87% jump in Revenue.
 */
export function isFavourable(pct: number, isExpense: boolean): boolean {
  return isExpense ? pct <= 0 : pct >= 0;
}

/** "+87.1%" / "-12.4%" */
export function formatVariance(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
