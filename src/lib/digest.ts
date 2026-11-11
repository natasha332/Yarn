import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dateIn } from "@/lib/format";
import { googleConfig, refreshAccessToken } from "@/lib/google";
import { listEvents, worthListing } from "@/lib/google-calendar";
import { decryptToken } from "@/lib/token-crypto";

// Everything the morning briefing and the day wrap-up need to say, gathered for one business.
// Works with whichever database connection it is given (her own login, for the test button).

export type DigestItem = {
  id: string;
  title: string;
  date: string | null;
  start: string | null; // "09:00"
  end: string | null;
  who: string; // "Priya · Kitchen reno"
  address: string | null;
  source?: "yarn" | "calendar"; // "calendar" = it's on her Google calendar, but Yarn didn't make it
  eventId?: string; // the Google event id, for items that come from her Google calendar
};

export type Digest = {
  today: string; // "2026-11-03"
  schedule: DigestItem[]; // bookings today
  tomorrow: DigestItem[]; // bookings tomorrow
  todos: DigestItem[]; // to-dos and follow-ups still open (overdue first)
  doneToday: DigestItem[]; // ticked off today
  waiting: number; // cards still to check
};

type One = { name: string } | { name: string }[] | null;
const nameOf = (v: One) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null;

type Row = {
  id: string;
  type: string;
  title: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  done_at?: string | null;
  external_id?: string | null;
  details: { address?: string | null } | null;
  clients: One;
  jobs: One;
};

const toItem = (r: Row): DigestItem => ({
  id: r.id,
  title: r.title,
  date: r.due_date,
  start: r.start_time?.slice(0, 5) ?? null,
  end: r.end_time?.slice(0, 5) ?? null,
  who: [nameOf(r.clients), nameOf(r.jobs)].filter(Boolean).join(" · "),
  address: r.details?.address ?? null,
});

const byWhen = (a: DigestItem, b: DigestItem) =>
  (a.date ?? "").localeCompare(b.date ?? "") ||
  (a.start ?? "").localeCompare(b.start ?? "");

const SELECT =
  "id, type, title, due_date, start_time, end_time, external_id, details, clients(name), jobs(name)";

const hhmmIn = (timeZone: string, moment: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(moment);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
};

// Other things on her main Google calendar on the given days (timed, not cancelled, not declined, not "free"),
// as list items. Includes events Yarn made itself: callers drop those by `eventId`.
// Never throws: if Google is unreachable the screen or email simply goes without them.
export async function otherCalendarEvents(
  supabase: SupabaseClient,
  business: { id: string; timezone: string },
  days: string[],
): Promise<DigestItem[]> {
  try {
    const config = googleConfig();
    if (!config) return [];
    const { data: connection } = await supabase
      .from("google_connections")
      .select("refresh_token_enc")
      .eq("business_id", business.id)
      .maybeSingle();
    if (!connection) return [];
    const { accessToken } = await refreshAccessToken(
      config,
      decryptToken(connection.refresh_token_enc),
    );
    if (!accessToken) return [];

    // Wide enough to cover those two local days in any timezone; trimmed to the exact days below.
    const first = days[0].split("-").map(Number);
    const last = days[days.length - 1].split("-").map(Number);
    const timeMin = new Date(
      Date.UTC(first[0], first[1] - 1, first[2]) - 14 * 3600e3,
    );
    const timeMax = new Date(
      Date.UTC(last[0], last[1] - 1, last[2] + 1) + 12 * 3600e3,
    );

    const items: DigestItem[] = [];
    for (const e of await listEvents(accessToken, timeMin, timeMax)) {
      if (!worthListing(e, new Set())) continue;
      const start = new Date(e.start!.dateTime!);
      const date = dateIn(business.timezone, start);
      if (!days.includes(date)) continue;
      items.push({
        id: `google-${e.id}`,
        title: e.summary?.trim() || "(No title)",
        date,
        start: hhmmIn(business.timezone, start),
        end: e.end?.dateTime
          ? hhmmIn(business.timezone, new Date(e.end.dateTime))
          : null,
        who: "",
        address: e.location ?? null,
        source: "calendar",
        eventId: e.id,
      });
    }
    return items;
  } catch (e) {
    console.error(
      "Google Calendar events:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

export async function loadDigest(
  supabase: SupabaseClient,
  business: { id: string; timezone: string },
  now: Date = new Date(),
): Promise<Digest> {
  const today = dateIn(business.timezone, now);
  const tomorrow = addDays(today, 1);

  const [open, done, waiting] = await Promise.all([
    supabase
      .from("items")
      .select(SELECT)
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .limit(1000),
    supabase
      .from("items")
      .select(`${SELECT}, done_at`)
      .eq("business_id", business.id)
      .eq("status", "done")
      .not("done_at", "is", null)
      .order("done_at", { ascending: false })
      .limit(200),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "pending"),
  ]);

  const rows = (open.data ?? []) as unknown as Row[];
  const calendar = rows.filter((r) => r.type === "calendar" && r.due_date);
  const doneRows = ((done.data ?? []) as unknown as Row[]).filter(
    (r) =>
      r.done_at && dateIn(business.timezone, new Date(r.done_at)) === today,
  );

  // Her other Google Calendar events join the same list, in time order.
  const yarnEventIds = new Set(
    rows.map((r) => r.external_id).filter((x): x is string => !!x),
  );
  const others = (
    await otherCalendarEvents(supabase, business, [today, tomorrow])
  ).filter((o) => !yarnEventIds.has(o.eventId ?? ""));

  return {
    today,
    schedule: [
      ...calendar.filter((r) => r.due_date === today).map(toItem),
      ...others.filter((o) => o.date === today),
    ].sort(byWhen),
    tomorrow: [
      ...calendar.filter((r) => r.due_date === tomorrow).map(toItem),
      ...others.filter((o) => o.date === tomorrow),
    ].sort(byWhen),
    // Same rule as the Today screen: overdue first, then due today, then the ones with no date.
    todos: rows
      .filter(
        (r) =>
          (r.type === "todo" || r.type === "followup") &&
          (!r.due_date || r.due_date <= today),
      )
      .map(toItem)
      .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")),
    doneToday: doneRows
      .filter((r) => r.type === "todo" || r.type === "followup")
      .map(toItem),
    waiting: waiting.count ?? 0,
  };
}
