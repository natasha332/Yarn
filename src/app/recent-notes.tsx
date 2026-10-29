import { requireBusiness } from "@/lib/business";
import { formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import WriteItDown from "./write-it-down";

export default async function RecentNotes() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("captures")
    .select("id, transcript, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl font-bold leading-none">Recent notes</h2>

      {!notes?.length ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
          Your notes will show up here after you record one.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-2 border-t border-line p-4 first:border-t-0">
              <span className="font-mono text-xs tracking-wide text-muted">
                {formatWhen(n.created_at, business.timezone)}
              </span>
              {n.transcript ? (
                <details className="group">
                  <summary className="cursor-pointer list-none italic group-open:hidden">
                    <span className="line-clamp-2">{n.transcript}</span>
                  </summary>
                  <p className="italic">{n.transcript}</p>
                </details>
              ) : n.transcript === "" ? (
                <p className="text-muted">Nothing was heard in this one.</p>
              ) : (
                <>
                  <p className="text-muted">
                    {n.status === "failed"
                      ? "This one didn't get written down."
                      : "Not written down yet."}
                  </p>
                  <WriteItDown captureId={n.id} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
