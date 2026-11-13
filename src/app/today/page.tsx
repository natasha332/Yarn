import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import { CARD_LABEL, CARD_TEXT_CLASS } from "@/lib/cards";
import {
  addDays,
  dateIn,
  formatClock,
  formatDay,
  formatLongDay,
  todayIn,
} from "@/lib/format";
import { otherCalendarEvents, type DigestItem } from "@/lib/digest";
import { createClient } from "@/lib/supabase/server";
import { personLabel } from "@/lib/people";
import BookingActions from "./booking-actions";
import GoogleStatus from "./google-status";
import TickButton from "./tick-button";

type Row = {
  id: string;
  type: string;
  title: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  external_id: string | null;
  details: {
    address?: string | null;
    notes?: string | null;
    calendar_sync?: string | null;
  } | null;
  clients:
    | { name: string; email: string | null; kind: string; role: string | null }
    | {
        name: string;
        email: string | null;
        kind: string;
        role: string | null;
      }[]
    | null;
  jobs: { name: string } | { name: string }[] | null;
};

const one = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;
const byTime = (a: Row, b: Row) =>
  (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
  (a.start_time ?? "").localeCompare(b.start_time ?? "");

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-2xl font-bold leading-none">
        {title}
        {count ? (
          <span className="ml-2 font-mono text-sm font-medium text-muted">
            {count}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
      {children}
    </p>
  );
}

// An event from her other Google Calendar entries: shown, but moved or cancelled in Google, not here.
function GoogleRow({ item, showDay }: { item: DigestItem; showDay?: boolean }) {
  return (
    <li
      className={`grid ${showDay ? "grid-cols-[6.5rem_1fr]" : "grid-cols-[4.5rem_1fr]"} gap-3 border-t border-line p-4 first:border-t-0`}
    >
      <span className="font-mono text-sm text-muted">
        {showDay && item.date ? (
          <>
            {formatDay(item.date)}
            <br />
          </>
        ) : null}
        {item.start ? formatClock(item.start) : "All day"}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`${showDay ? "" : "text-lg "}font-semibold leading-snug`}
          >
            {item.title}
          </span>
          <span className="rounded-full bg-sunk px-2 py-0.5 text-xs font-bold text-muted">
            Calendar
          </span>
        </span>
        {item.address && <span className="text-muted">{item.address}</span>}
        {!showDay && item.start && item.end && (
          <span className="font-mono text-xs text-muted">
            until {formatClock(item.end)}
          </span>
        )}
      </div>
    </li>
  );
}

async function TodayContent() {
  const business = await requireBusiness();
  const today = todayIn(business.timezone);
  const soon = addDays(today, 7);
  const supabase = await createClient();

  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  const [{ data }, { count: waiting }, { data: google }, googleEvents] =
    await Promise.all([
      supabase
        .from("items")
        .select(
          "id, type, title, due_date, start_time, end_time, created_at, external_id, details, clients(name, email, kind, role), jobs(name)",
        )
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("google_connections").select("business_id").maybeSingle(),
      // Her other Google Calendar events (nothing, if Google isn't connected or can't be reached).
      otherCalendarEvents(supabase, business, days),
    ]);
  const connected = !!google;
  const rows = (data ?? []) as Row[];
  const yarnEventIds = new Set(
    rows.map((r) => r.external_id).filter((x): x is string => !!x),
  );
  const others = googleEvents.filter((o) => !yarnEventIds.has(o.eventId ?? ""));

  const schedule = rows
    .filter((r) => r.type === "calendar" && r.due_date === today)
    .sort(byTime);
  const coming = rows
    .filter(
      (r) =>
        r.type === "calendar" &&
        r.due_date &&
        r.due_date > today &&
        r.due_date <= soon,
    )
    .sort(byTime);
  // Yarn bookings and her other calendar events share one list, in time order.
  type Entry =
    | { kind: "yarn"; row: Row; date: string; start: string }
    | { kind: "google"; item: DigestItem; date: string; start: string };
  const entries = (day: (d: string) => boolean, yarn: Row[]): Entry[] =>
    [
      ...yarn.map(
        (row): Entry => ({
          kind: "yarn",
          row,
          date: row.due_date!,
          start: row.start_time?.slice(0, 5) ?? "",
        }),
      ),
      ...others
        .filter((o) => o.date && day(o.date))
        .map(
          (item): Entry => ({
            kind: "google",
            item,
            date: item.date!,
            start: item.start ?? "",
          }),
        ),
    ].sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    );
  const scheduleEntries = entries((d) => d === today, schedule);
  const comingEntries = entries((d) => d > today && d <= soon, coming);

  // Overdue first, then due today, then the ones with no date.
  const todos = rows
    .filter(
      (r) =>
        (r.type === "todo" || r.type === "followup") &&
        (!r.due_date || r.due_date <= today),
    )
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const notes = rows.filter(
    (r) =>
      r.type === "note" &&
      dateIn(business.timezone, new Date(r.created_at)) === today,
  );

  const googleState = (r: Row) =>
    r.external_id
      ? r.details?.calendar_sync
        ? ("behind" as const)
        : ("synced" as const)
      : ("missing" as const);

  const who = (r: Row) =>
    [personLabel(one(r.clients)), one(r.jobs)?.name]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-5xl font-bold leading-none">
          {formatLongDay(today)}
        </h1>
        <p className="text-muted">{business.name}</p>
      </header>

      {!!waiting && (
        <Link
          href="/"
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-accent bg-surface px-4 py-3 font-semibold"
        >
          <span>
            {waiting} {waiting === 1 ? "card is" : "cards are"} waiting for you
            to check
          </span>
          <span className="text-accent">Check →</span>
        </Link>
      )}

      <Section title="Schedule" count={scheduleEntries.length}>
        {scheduleEntries.length === 0 ? (
          <Empty>Nothing booked for today.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {scheduleEntries.map((entry) =>
              entry.kind === "google" ? (
                <GoogleRow key={entry.item.id} item={entry.item} />
              ) : (
                ((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[4.5rem_1fr] gap-3 border-t border-line p-4 first:border-t-0"
                  >
                    <span className="font-mono text-sm text-muted">
                      {r.start_time
                        ? formatClock(r.start_time.slice(0, 5))
                        : "All day"}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-lg font-semibold leading-snug">
                        {r.title}
                      </span>
                      {who(r) && <span className="text-muted">{who(r)}</span>}
                      {r.details?.address && (
                        <span className="text-muted">{r.details.address}</span>
                      )}
                      {r.end_time && r.start_time && (
                        <span className="font-mono text-xs text-muted">
                          until {formatClock(r.end_time.slice(0, 5))}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex flex-col">
                      {connected && (
                        <GoogleStatus id={r.id} state={googleState(r)} />
                      )}
                      <BookingActions
                        id={r.id}
                        title={r.title}
                        date={r.due_date!}
                        start={r.start_time}
                        end={r.end_time}
                        timezone={business.timezone}
                        clientName={one(r.clients)?.name ?? null}
                        canEmail={!!one(r.clients)?.email}
                      />
                    </div>
                  </li>
                ))(entry.row)
              ),
            )}
          </ul>
        )}
      </Section>

      <Section title="To-dos and follow-ups" count={todos.length}>
        {todos.length === 0 ? (
          <Empty>Nothing to do. Nice.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {todos.map((r) => {
              const overdue = !!r.due_date && r.due_date < today;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 border-t border-line p-4 first:border-t-0"
                >
                  <TickButton id={r.id} title={r.title} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${CARD_TEXT_CLASS[r.type]}`}
                    >
                      {CARD_LABEL[r.type]}
                    </span>
                    <span className="text-lg font-semibold leading-snug">
                      {r.title}
                    </span>
                    {who(r) && <span className="text-muted">{who(r)}</span>}
                    {r.due_date && (
                      <span
                        className={`font-mono text-xs ${overdue ? "font-bold text-variation" : "text-muted"}`}
                      >
                        {overdue
                          ? `Overdue · was ${formatDay(r.due_date)}`
                          : "Due today"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Job notes" count={notes.length}>
        {notes.length === 0 ? (
          <Empty>No job notes from today.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {notes.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-0.5 border-t border-line p-4 first:border-t-0"
              >
                <span className="text-lg font-semibold leading-snug">
                  {r.title}
                </span>
                {who(r) && <span className="text-muted">{who(r)}</span>}
                {r.details?.notes && (
                  <span className="text-muted">{r.details.notes}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {comingEntries.length > 0 && (
        <Section title="Coming up" count={comingEntries.length}>
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {comingEntries.map((entry) =>
              entry.kind === "google" ? (
                <GoogleRow key={entry.item.id} item={entry.item} showDay />
              ) : (
                ((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-line p-4 first:border-t-0"
                  >
                    <span className="font-mono text-sm text-muted">
                      {formatDay(r.due_date!)}
                      <br />
                      {r.start_time
                        ? formatClock(r.start_time.slice(0, 5))
                        : "All day"}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold leading-snug">
                        {r.title}
                      </span>
                      {who(r) && <span className="text-muted">{who(r)}</span>}
                    </div>
                    <div className="col-span-2 flex flex-col">
                      {connected && (
                        <GoogleStatus id={r.id} state={googleState(r)} />
                      )}
                      <BookingActions
                        id={r.id}
                        title={r.title}
                        date={r.due_date!}
                        start={r.start_time}
                        end={r.end_time}
                        timezone={business.timezone}
                        clientName={one(r.clients)?.name ?? null}
                        canEmail={!!one(r.clients)?.email}
                      />
                    </div>
                  </li>
                ))(entry.row)
              ),
            )}
          </ul>
        </Section>
      )}
    </>
  );
}

export default function TodayPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <TodayContent />
      </Suspense>
    </main>
  );
}
