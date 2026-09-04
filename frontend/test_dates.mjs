/**
 * Timezone regression test for the date presets.
 *
 * The bug: toISOString() converts to UTC, so local midnight in a UTC+ zone
 * rolled back a day and "Last month" read 31-07-2026 to 30-08-2026 instead
 * of 01-08-2026 to 31-08-2026.
 *
 * Run across several timezones:
 *   node test_dates.mjs
 */

import { execFileSync } from "node:child_process";

// Mirrors lib/dates.ts. Kept in sync deliberately -- this file must be
// runnable as plain node without a TypeScript build step.
const SRC = `
const isoLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return \`\${y}-\${m}-\${day}\`;
};
const monthStart = (o = 0) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + o, 1); };
const monthEnd   = (o = 0) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + o + 1, 0); };
const todayLocal = () => isoLocal(new Date());

const q = Math.floor(new Date().getMonth() / 3);
const y = new Date().getFullYear();

console.log(JSON.stringify({
  offsetMin:   new Date().getTimezoneOffset(),
  today:       todayLocal(),
  thisMonth:   [isoLocal(monthStart(0)),  todayLocal()],
  lastMonth:   [isoLocal(monthStart(-1)), isoLocal(monthEnd(-1))],
  thisQuarter: [isoLocal(new Date(y, q * 3, 1)), todayLocal()],
  ytdStart:    isoLocal(new Date(y, 0, 1)),
}));
`;

// Zones spanning UTC-11 .. UTC+14, plus half-hour and 45-minute offsets,
// because those are where naive fixes tend to fail.
const ZONES = [
  "Pacific/Midway",      // -11
  "America/Los_Angeles", // -8/-7
  "America/New_York",    // -5/-4
  "UTC",                 //   0
  "Europe/London",       //  0/+1
  "Asia/Kolkata",        // +5:30  <- the reported bug
  "Asia/Kathmandu",      // +5:45
  "Asia/Tokyo",          // +9
  "Pacific/Auckland",    // +12/+13
  "Pacific/Kiritimati",  // +14
];

let failures = 0;

// Fixed "now" so the expectation is deterministic: 3 Sep 2026, 12:00 local.
const FIXED_NOW = "2026-09-03T12:00:00";

for (const tz of ZONES) {
  const out = execFileSync(
    process.execPath,
    [
      "-e",
      // Pin Date.now() so the test does not drift with the wall clock.
      `const R=Date; const fixed=new R("${FIXED_NOW}").getTime();
       globalThis.Date = class extends R {
         constructor(...a){ return a.length ? new R(...a) : new R(fixed); }
         static now(){ return fixed; }
       };
       ${SRC}`,
    ],
    { env: { ...process.env, TZ: tz }, encoding: "utf8" }
  );

  const r = JSON.parse(out);

  // Clock pinned to 3 Sep 2026.
  const expected = {
    today: "2026-09-03",
    // Month-to-date and quarter-to-date end TODAY, not at period end.
    thisMonth: ["2026-09-01", "2026-09-03"],
    thisQuarter: ["2026-07-01", "2026-09-03"],
    // A completed month still runs to the calendar month end.
    lastMonth: ["2026-08-01", "2026-08-31"],
    ytdStart: "2026-01-01",
  };

  const problems = [];
  if (r.today !== expected.today) problems.push(`today=${r.today}`);
  for (const k of ["thisMonth", "lastMonth", "thisQuarter"]) {
    if (r[k].join("..") !== expected[k].join("..")) {
      problems.push(`${k}=${r[k].join("..")}`);
    }
  }
  if (r.ytdStart !== expected.ytdStart) problems.push(`ytdStart=${r.ytdStart}`);

  const ok = problems.length === 0;
  if (!ok) failures++;
  const off = `UTC${r.offsetMin <= 0 ? "+" : "-"}${String(Math.floor(Math.abs(r.offsetMin) / 60)).padStart(2, "0")}:${String(Math.abs(r.offsetMin) % 60).padStart(2, "0")}`;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${tz.padEnd(22)} ${off.padEnd(10)} ` +
      `MTD ${r.thisMonth.join("..")}  QTD ${r.thisQuarter.join("..")}  ` +
      `last month ${r.lastMonth.join("..")}` +
      (ok ? "" : `   << ${problems.join(", ")}`)
  );
}

console.log("=".repeat(72));
if (failures) {
  console.log(`${failures} TIMEZONE(S) FAILED`);
  process.exit(1);
}
console.log(`ALL ${ZONES.length} TIMEZONES PASSED`);
