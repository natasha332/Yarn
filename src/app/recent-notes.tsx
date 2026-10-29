import { requireBusiness } from "@/lib/business";
import { formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { removePromptEcho } from "@/lib/transcript";
import DeleteNote from "./delete-note";
import WriteItDown from "./write-it-down";

export default async function RecentNotes() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("captures")
    .select("id, transcript, status, created_at, audio_url")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl font-bold leading-none">
        Recent notes
      </h2>

      {!notes?.length ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
          Your notes will show up here after you record one.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {notes.map((n) => {
            // Old notes may hold a hint the transcriber read back on silence: clean it here too.
            const heard =
              n.transcript === null ? null : removePromptEcho(n.transcript);
            return (
              <li
                key={n.id}
                className="flex flex-col gap-2 border-t border-line p-4 first:border-t-0"
              >
                <div className="-my-2 flex items-center justify-between">
                  <span className="font-mono text-xs tracking-wide text-muted">
                    {formatWhen(n.created_at, business.timezone)}
                  </span>
                  <DeleteNote captureId={n.id} audioPath={n.audio_url} />
                </div>
                {heard ? (
                  <details className="group">
                    <summary className="cursor-pointer list-none italic group-open:hidden">
                      <span className="line-clamp-2">{heard}</span>
                    </summary>
                    <p className="italic">{heard}</p>
                  </details>
                ) : heard === "" ? (
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
