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
import { createClient } from "@/lib/supabase/server";
import BookingActions from "./booking-actions";
import TickButton from "./tick-button";

type Row = {
  id: string;
  type: string;
  title: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  details: { address?: string | null; notes?: string | null } | null;
  clients: { name: string } | { name: string }[] | null;
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

async function TodayContent() {
  const business = await requireBusiness();
  const today = todayIn(business.timezone);
  const soon = addDays(today, 7);
  const supabase = await createClient();

  const [{ data }, { count: waiting }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, type, title, due_date, start_time, end_time, created_at, details, clients(name), jobs(name)",
      )
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const rows = (data ?? []) as Row[];

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

  const who = (r: Row) =>
    [one(r.clients)?.name, one(r.jobs)?.name].filter(Boolean).join(" · ");

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

      <Section title="Schedule" count={schedule.length}>
        {schedule.length === 0 ? (
          <Empty>Nothing booked for today.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {schedule.map((r) => (
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
                  <BookingActions
                    id={r.id}
                    title={r.title}
                    date={r.due_date!}
                    start={r.start_time}
                    end={r.end_time}
                  />
                </div>
              </li>
            ))}
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

      {coming.length > 0 && (
        <Section title="Coming up" count={coming.length}>
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {coming.map((r) => (
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
                  <span className="font-semibold leading-snug">{r.title}</span>
                  {who(r) && <span className="text-muted">{who(r)}</span>}
                  <BookingActions
                    id={r.id}
                    title={r.title}
                    date={r.due_date!}
                    start={r.start_time}
                    end={r.end_time}
                  />
                </div>
              </li>
            ))}
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
