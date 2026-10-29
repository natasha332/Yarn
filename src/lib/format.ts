// Dates and times the way Yarn shows them: "Tue 3 Nov" and "9:00am".
function parts(date: Date, options: Intl.DateTimeFormatOptions, timeZone: string) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-AU", { timeZone, ...options }).formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out;
}

export function formatWhen(iso: string, timeZone: string) {
  const date = new Date(iso);
  const d = parts(date, { weekday: "short", day: "numeric", month: "short" }, timeZone);
  const t = parts(date, { hour: "numeric", minute: "2-digit", hour12: true }, timeZone);
  return `${d.weekday} ${d.day} ${d.month} · ${t.hour}:${t.minute}${(t.dayPeriod ?? "").toLowerCase()}`;
}
