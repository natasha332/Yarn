import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { STATUS_TEXT_CLASS, statusLabel } from "@/lib/jobs";

async function JobList() {
  await requireBusiness();
  const supabase = await createClient();
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, name, address, status, clients(name)")
    .order("created_at", { ascending: false });

  if (error) {
    return <p role="alert" className="text-variation">{error.message}</p>;
  }
  if (!jobs?.length) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
        No jobs yet. Tap <b>New job</b> to put in your first one.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-xl border border-line bg-surface">
      {jobs.map((j) => {
        const client = Array.isArray(j.clients) ? j.clients[0] : j.clients;
        return (
          <li key={j.id} className="border-t border-line first:border-t-0">
            <Link href={`/jobs/${j.id}`} className="flex min-h-16 flex-col justify-center gap-0.5 px-4 py-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold">{j.name}</span>
                <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${STATUS_TEXT_CLASS[j.status] ?? ""}`}>
                  {statusLabel(j.status)}
                </span>
              </span>
              <span className="text-muted">
                {[client?.name, j.address].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function JobsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/" className="flex h-12 items-center text-muted underline">
        ← Home
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">Jobs</h1>
      <Link
        href="/jobs/new"
        className="flex h-14 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
      >
        New job
      </Link>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <JobList />
      </Suspense>
    </main>
  );
}
