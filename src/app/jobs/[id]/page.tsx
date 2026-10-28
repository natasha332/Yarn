import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import EditJobForm from "./edit-job-form";

async function Edit({ params }: Pick<PageProps<"/jobs/[id]">, "params">) {
  const { id } = await params;
  await requireBusiness();
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, name, address, status, client_id, clients(id, name, phone)")
    .eq("id", id)
    .maybeSingle();

  // Not found, or it belongs to someone else (row-level security hides it).
  if (!job) notFound();

  const client = Array.isArray(job.clients) ? job.clients[0] : job.clients;

  return (
    <>
      {client && (
        <Link
          href={`/clients/${client.id}`}
          className="flex min-h-16 flex-col justify-center rounded-xl border border-line bg-surface px-4 py-3"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-muted">Client</span>
          <span className="text-lg font-semibold">{client.name}</span>
          {client.phone && <span className="text-muted">{client.phone}</span>}
        </Link>
      )}
      <EditJobForm job={{ id: job.id, name: job.name, address: job.address, status: job.status }} />
    </>
  );
}

export default function EditJobPage(props: PageProps<"/jobs/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/jobs" className="flex h-12 items-center text-muted underline">
        ← Jobs
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">Edit job</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Edit params={props.params} />
      </Suspense>
    </main>
  );
}
