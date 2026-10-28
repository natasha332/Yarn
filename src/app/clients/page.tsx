import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

async function ClientList() {
  await requireBusiness();
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, phone, address")
    .order("name");

  if (error) {
    return <p role="alert" className="text-variation">{error.message}</p>;
  }
  if (!clients?.length) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
        No clients yet. Tap <b>Add client</b> to put in your first one.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-xl border border-line bg-surface">
      {clients.map((c) => (
        <li key={c.id} className="border-t border-line first:border-t-0">
          <Link href={`/clients/${c.id}`} className="flex min-h-16 flex-col justify-center px-4 py-3">
            <span className="text-lg font-semibold">{c.name}</span>
            {(c.phone || c.address) && (
              <span className="text-muted">
                {[c.phone, c.address].filter(Boolean).join(" · ")}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ClientsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/" className="flex h-12 items-center text-muted underline">
        ← Home
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">Clients</h1>
      <Link
        href="/clients/new"
        className="flex h-14 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
      >
        Add client
      </Link>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ClientList />
      </Suspense>
    </main>
  );
}
