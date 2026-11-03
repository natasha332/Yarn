import { addDays } from "@/lib/format";

// Putting Yarn bookings on her main Google calendar ("primary").
const API = process.env.GOOGLE_CALENDAR_URL ?? "https://www.googleapis.com/calendar/v3";

// Every event Yarn makes pops up a reminder this long before it starts.
export const REMINDER_MINUTES = 30;
const DEFAULT_LENGTH_MINUTES = 60;

export type BookingForGoogle = {
  title: string;
  due_date: string; // "2026-11-03"
  start_time: string | null; // "09:00:00"
  end_time: string | null;
  details: { address?: string | null; notes?: string | null } | null;
  clientName?: string | null;
  jobName?: string | null;
};

// Google lets us choose an event's id (letters a-v and digits). Using the booking's own id means
// a double tap, or a retry after a dropped connection, can never create the event twice.
export const eventIdFor = (itemId: string) => itemId.replaceAll("-", "").toLowerCase();

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// "2026-11-03" + minutes into the day (can run past midnight) -> { date, time: "10:00" }
function at(date: string, mins: number) {
  const day = addDays(date, Math.floor(mins / 1440));
  const m = ((mins % 1440) + 1440) % 1440;
  const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { date: day, time };
}

// Just the when. Used for a move, so anything she has added in Google herself
// (guests, notes, a different reminder) is left alone.
export function buildTimes(b: BookingForGoogle, timeZone: string) {
  let start;
  let end;
  if (b.start_time) {
    const from = minutes(b.start_time);
    const to = b.end_time && minutes(b.end_time) > from ? minutes(b.end_time) : from + DEFAULT_LENGTH_MINUTES;
    const s = at(b.due_date, from);
    const e = at(b.due_date, to);
    start = { dateTime: `${s.date}T${s.time}:00`, timeZone, date: null };
    end = { dateTime: `${e.date}T${e.time}:00`, timeZone, date: null };
  } else {
    // A timed event can become all-day and back, so the unused fields are cleared.
    start = { date: b.due_date, dateTime: null, timeZone: null };
    end = { date: addDays(b.due_date, 1), dateTime: null, timeZone: null };
  }
  return { start, end };
}

// The whole event, for adding it.
export function buildEvent(b: BookingForGoogle, timeZone: string) {
  const description = [
    b.clientName && `Client: ${b.clientName}`,
    b.jobName && `Job: ${b.jobName}`,
    b.details?.notes,
    "Added by Yarn",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: b.title,
    location: b.details?.address || null,
    description,
    ...buildTimes(b, timeZone),
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: REMINDER_MINUTES }] },
  };
}

export type CalendarResult = { ok: true } | { ok: false; reason: "auth" | "api"; message: string };

async function call(accessToken: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}/calendars/primary/events${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res;
}

async function failure(res: Response): Promise<CalendarResult> {
  const text = await res.text().catch(() => "");
  return {
    ok: false,
    reason: res.status === 401 || res.status === 403 ? "auth" : "api",
    message: `Google said ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
  };
}

export async function updateEvent(accessToken: string, eventId: string, event: object): Promise<CalendarResult> {
  const res = await call(accessToken, "PATCH", `/${eventId}`, event);
  return res.ok ? { ok: true } : failure(res);
}

export async function createEvent(accessToken: string, eventId: string, event: object): Promise<CalendarResult> {
  const res = await call(accessToken, "POST", "", { id: eventId, ...event });
  if (res.status === 409) return updateEvent(accessToken, eventId, event); // already there: just bring it up to date
  return res.ok ? { ok: true } : failure(res);
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<CalendarResult> {
  const res = await call(accessToken, "DELETE", `/${eventId}`);
  if (res.ok || res.status === 404 || res.status === 410) return { ok: true }; // already gone is fine
  return failure(res);
}
