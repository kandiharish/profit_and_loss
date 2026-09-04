/**
 * Variance sign tests.
 *
 * Imports lib/variance.ts directly — Node 24 strips TypeScript types
 * natively, so there is no mirrored copy here to drift out of sync.
 *
 *   node test_variance.mjs
 */

import {
  formatVariance,
  isExpenseSection,
  isFavourable,
  variancePct,
} from "./lib/variance.ts";

let failures = 0;

function check(label, actual, expected) {
  const ok = Object.is(actual, expected) || actual === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `   got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
  );
}

const round1 = (n) => (n === null ? null : Number(n.toFixed(1)));

console.log("--- The reported case: Operating Expenses ---");
const OPEX_PRIOR = -1974357.92;
const OPEX_NOW = -3694294.11;

check(
  "Opex (1,974,357.92) -> (3,694,294.11) reads +87.1%",
  round1(variancePct(OPEX_NOW, OPEX_PRIOR, true)),
  87.1
);
check(
  "  ...and formats as '+87.1%'",
  formatVariance(variancePct(OPEX_NOW, OPEX_PRIOR, true)),
  "+87.1%"
);
check(
  "  ...without the expense flag it would have read -87.1% (the bug)",
  round1(variancePct(OPEX_NOW, OPEX_PRIOR, false)),
  -87.1
);
check(
  "An 87.1% rise in expenses is UNfavourable",
  isFavourable(variancePct(OPEX_NOW, OPEX_PRIOR, true), true),
  false
);

console.log("\n--- Expenses, other directions ---");
check("Expense 100 -> 80 reads -20% (spent less)",
  round1(variancePct(-80, -100, true)), -20);
check("  ...and is favourable",
  isFavourable(variancePct(-80, -100, true), true), true);
check("Expense unchanged reads 0%",
  round1(variancePct(-100, -100, true)), 0);
check("Zero variance counts as favourable for expenses",
  isFavourable(0, true), true);

// Sign flip: an expense account that ends the period as a net credit.
// Magnitude-based maths would call this -50%; negating the raw variance
// correctly calls it -150%.
check("Expense 100 -> net credit 50 reads -150%",
  round1(variancePct(50, -100, true)), -150);

console.log("\n--- Income and profit keep the plain reading ---");
check("Revenue 100 -> 150 reads +50%",
  round1(variancePct(150, 100, false)), 50);
check("  ...and is favourable",
  isFavourable(variancePct(150, 100, false), false), true);
check("Revenue 100 -> 80 reads -20%",
  round1(variancePct(80, 100, false)), -20);
check("  ...and is UNfavourable",
  isFavourable(variancePct(80, 100, false), false), false);
check("Net income 100 -> 150 reads +50% (subtotals are not expenses)",
  round1(variancePct(150, 100, false)), 50);
check("Net income turning to a loss reads negative",
  round1(variancePct(-50, 100, false)), -150);

console.log("\n--- No meaningful base ---");
check("Prior of 0 gives null", variancePct(500, 0, true), null);
check("Prior undefined gives null", variancePct(500, undefined, true), null);
check("Prior null gives null", variancePct(500, null, false), null);
check("NaN gives null", variancePct(NaN, 100, false), null);

console.log("\n--- Which sections are expenses ---");
for (const k of ["cogs", "opex", "other_expense"]) {
  check(`'${k}' is an expense section`, isExpenseSection(k), true);
}
for (const k of ["revenue", "other_income"]) {
  check(`'${k}' is NOT an expense section`, isExpenseSection(k), false);
}
// Subtotal keys must not be treated as expense sections.
for (const k of ["gross_profit", "operating_income", "net_income"]) {
  check(`'${k}' is NOT an expense section`, isExpenseSection(k), false);
}

console.log("\n--- Formatting ---");
check("Positive gets an explicit +", formatVariance(87.1146), "+87.1%");
check("Negative keeps its -", formatVariance(-12.44), "-12.4%");
check("Zero shows +0.0%", formatVariance(0), "+0.0%");

console.log("=".repeat(64));
if (failures) {
  console.log(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("ALL VARIANCE TESTS PASSED");
