import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dateIn } from "@/lib/format";

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
  (a.date ?? "").localeCompare(b.date ?? "") || (a.start ?? "").localeCompare(b.start ?? "");

const SELECT =
  "id, type, title, due_date, start_time, end_time, details, clients(name), jobs(name)";

export async function loadDigest(
  supabase: SupabaseClient,
  business: { id: string; timezone: string },
  now: Date = new Date(),
): Promise<Digest> {
  const today = dateIn(business.timezone, now);
  const tomorrow = addDays(today, 1);

  const [open, done, waiting] = await Promise.all([
    supabase.from("items").select(SELECT).eq("business_id", business.id).eq("status", "confirmed").limit(1000),
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
    (r) => r.done_at && dateIn(business.timezone, new Date(r.done_at)) === today,
  );

  return {
    today,
    schedule: calendar.filter((r) => r.due_date === today).map(toItem).sort(byWhen),
    tomorrow: calendar.filter((r) => r.due_date === tomorrow).map(toItem).sort(byWhen),
    // Same rule as the Today screen: overdue first, then due today, then the ones with no date.
    todos: rows
      .filter((r) => (r.type === "todo" || r.type === "followup") && (!r.due_date || r.due_date <= today))
      .map(toItem)
      .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")),
    doneToday: doneRows.filter((r) => r.type === "todo" || r.type === "followup").map(toItem),
    waiting: waiting.count ?? 0,
  };
}
