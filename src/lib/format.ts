// Dates and times the way Yarn shows them: "Tue 3 Nov" and "9:00am".
function parts(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string,
) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-AU", {
    timeZone,
    ...options,
  }).formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out;
}

export function formatWhen(iso: string, timeZone: string) {
  const date = new Date(iso);
  const d = parts(
    date,
    { weekday: "short", day: "numeric", month: "short" },
    timeZone,
  );
  const t = parts(
    date,
    { hour: "numeric", minute: "2-digit", hour12: true },
    timeZone,
  );
  return `${d.weekday} ${d.day} ${d.month} · ${t.hour}:${t.minute}${(t.dayPeriod ?? "").toLowerCase()}`;
}

// "2026-11-03" -> "Tue 3 Nov". Plain calendar maths, so no timezone can shift the day.
export function formatDay(dateString: string) {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const p = parts(
    date,
    { weekday: "short", day: "numeric", month: "short" },
    "UTC",
  );
  return `${p.weekday} ${p.day} ${p.month}`;
}

// "09:00" -> "9:00am", "14:30" -> "2:30pm"
export function formatClock(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

// A moment's date in the business's own timezone, as "2026-11-03".
export function dateIn(timeZone: string, moment: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

// Today's date in the business's own timezone.
export function todayIn(timeZone: string) {
  return dateIn(timeZone);
}

// "2026-11-03" plus 4 days is "2026-11-07". Plain calendar maths.
export function addDays(dateString: string, days: number) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "2026-11-03" -> "Tuesday 3 November"
export function formatLongDay(dateString: string) {
  const [y, m, d] = dateString.split("-").map(Number);
  const p = parts(
    new Date(Date.UTC(y, m - 1, d)),
    { weekday: "long", day: "numeric", month: "long" },
    "UTC",
  );
  return `${p.weekday} ${p.day} ${p.month}`;
}

// "2026-11-05" -> "05/11/2026" (day first)
export function formatNumericDay(dateString: string) {
  const [y, m, d] = dateString.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}
