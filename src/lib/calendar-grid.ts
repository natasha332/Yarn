// The days to draw for one month of Yarn's date picker. Weeks start on Monday, like an Australian calendar.

export type Day = { iso: string; day: number; inMonth: boolean };

// month0 is 0 for January ... 11 for December.
export function monthGrid(year: number, month0: number): Day[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  const start = Date.UTC(year, month0, 1 - mondayOffset);

  const weeks: Day[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Day[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start + (w * 7 + d) * 86_400_000);
      row.push({
        iso: date.toISOString().slice(0, 10),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month0,
      });
    }
    weeks.push(row);
  }
  // Don't draw a last row that's all next month.
  return weeks.filter((row, i) => i < 5 || row.some((c) => c.inMonth));
}

export function shiftMonth(year: number, month0: number, by: number) {
  const date = new Date(Date.UTC(year, month0 + by, 1));
  return { year: date.getUTCFullYear(), month0: date.getUTCMonth() };
}

// "November 2026"
export function monthTitle(year: number, month0: number) {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month0, 1)));
}

// The phone's own idea of today, as "2026-11-03".
export function deviceToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
