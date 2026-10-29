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
