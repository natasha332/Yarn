import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

// Contacts: your clients (customers) and your business contacts (accountant, suppliers, sales reps...).
// A switch at the top picks which list; the choice is in the address (?kind=contact) so Back works.

const tab = (on: boolean) =>
  `flex h-11 items-center justify-center rounded-lg font-semibold ${
    on ? "bg-surface text-ink shadow-sm" : "text-muted"
  }`;

export function RoleChip({ role }: { role: string | null | undefined }) {
  if (!role) return null;
  return (
    <span className="ml-2 inline-block rounded-full bg-sunk px-2 py-0.5 align-middle text-sm font-semibold text-muted">
      {role}
    </span>
  );
}

async function Body({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const contacts = kind === "contact";
  await requireBusiness();
  const supabase = await createClient();
  const { data: people, error } = await supabase
    .from("clients")
    .select("id, name, phone, email, address, role")
    .eq("kind", contacts ? "contact" : "client")
    .order("name");

  return (
    <>
      <nav
        aria-label="Which list"
        className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-sunk p-1"
      >
        <Link
          href="/clients"
          aria-current={contacts ? undefined : "page"}
          className={tab(!contacts)}
        >
          Clients
        </Link>
        <Link
          href="/clients?kind=contact"
          aria-current={contacts ? "page" : undefined}
          className={tab(contacts)}
        >
          Business contacts
        </Link>
      </nav>
      <Link
        href={contacts ? "/clients/new?kind=contact" : "/clients/new"}
        className="flex h-14 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
      >
        {contacts ? "Add business contact" : "Add client"}
      </Link>

      {error ? (
        <p role="alert" className="text-variation">
          {error.message}
        </p>
      ) : !people?.length ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
          {contacts ? (
            <>
              No business contacts yet. Add your accountant, suppliers or sales
              reps, and you can say things like &quot;email my accountant&quot;.
            </>
          ) : (
            <>
              No clients yet. Tap <b>Add client</b> to put in your first one.
            </>
          )}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {people.map((c) => (
            <li key={c.id} className="border-t border-line first:border-t-0">
              <Link
                href={`/clients/${c.id}`}
                className="flex min-h-16 flex-col justify-center px-4 py-3"
              >
                <span className="text-lg font-semibold">
                  {c.name}
                  {contacts && <RoleChip role={c.role} />}
                </span>
                {(contacts ? c.phone || c.email : c.phone || c.address) && (
                  <span className="text-muted">
                    {(contacts ? [c.phone, c.email] : [c.phone, c.address])
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ContactsPage(props: PageProps<"/clients">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <h1 className="font-display text-5xl font-bold leading-none">Contacts</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Body searchParams={props.searchParams as Promise<{ kind?: string }>} />
      </Suspense>
    </main>
  );
}
