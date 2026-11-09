import { monthGrid, shiftMonth, monthTitle } from "../.tmp/lib/calendar-grid.ts";
let bad = 0;
const t = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? "PASS" : "FAIL", "-", name, ok ? "" : `\n   wanted ${JSON.stringify(want)}\n   got    ${JSON.stringify(got)}`); };
const nov = monthGrid(2026, 10); // November 2026: 1 Nov is a Sunday
t("weeks have 7 days", nov.every(w => w.length === 7), true);
t("the first column is Monday: 26 Oct 2026 is a Monday", nov[0][0].iso, "2026-10-26");
t("1 Nov 2026 (a Sunday) sits in the LAST column of the first week", nov[0][6].iso, "2026-11-01");
t("Thursday 5 November is the 4th column", nov[1][3].iso, "2026-11-05");
t("days outside the month are marked", [nov[0][0].inMonth, nov[0][6].inMonth], [false, true]);
t("30 Nov is in the grid", nov.flat().some(d => d.iso === "2026-11-30" && d.inMonth), true);
t("every day of the month appears exactly once", nov.flat().filter(d => d.inMonth).length, 30);
const feb = monthGrid(2027, 1); // Feb 2027 starts on a Monday and has 28 days: exactly 4 weeks + ...
t("a month that fits 4 rows doesn't draw empty rows past 5", feb.length <= 5 && feb.flat().filter(d => d.inMonth).length === 28, true);
t("leap year February has 29 days", monthGrid(2028, 1).flat().filter(d => d.inMonth).length, 29);
t("a month that needs 6 rows gets them (Aug 2026 starts Sat, 31 days)", monthGrid(2026, 7).length, 6);
t("next month from December rolls into January", shiftMonth(2026, 11, 1), { year: 2027, month0: 0 });
t("previous month from January rolls back to December", shiftMonth(2027, 0, -1), { year: 2026, month0: 11 });
t("title", monthTitle(2026, 10), "November 2026");
process.exit(bad ? 1 : 0);
