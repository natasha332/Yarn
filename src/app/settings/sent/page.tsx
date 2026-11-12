import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import { formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Every email Yarn has sent (or tried to send) to your clients, newest first.

type Row = {
  id: string;
  to_email: string;
  subject: string;
  body: string | null;
  status: "sent" | "failed";
  error: string | null;
  sent_at: string;
  clients: { name: string } | { name: string }[] | null;
};

async function SentList() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sent_emails")
    .select(
      "id, to_email, subject, body, status, error, sent_at, clients(name)",
    )
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
        Couldn&apos;t load the list. If you haven&apos;t run the latest database
        update yet, do that first.
      </p>
    );
  }
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-muted">
        Nothing sent yet. Emails you send to clients from Yarn will be listed
        here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
        return (
          <li
            key={r.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <p
              className={`text-xs font-bold uppercase tracking-wide ${r.status === "sent" ? "text-invoice" : "text-variation"}`}
            >
              {r.status === "sent" ? "✓ Sent" : "⚠ Didn't send"}
              <span className="ml-2 font-mono font-normal normal-case text-muted">
                {formatWhen(r.sent_at, business.timezone)}
              </span>
            </p>
            <p className="mt-1 text-lg font-semibold leading-snug">
              {r.subject}
            </p>
            <p className="text-muted">
              To {client?.name ? `${client.name} · ` : ""}
              <span className="font-mono text-sm">{r.to_email}</span>
            </p>
            {r.status === "failed" && r.error && (
              <p className="mt-1 text-variation">{r.error}</p>
            )}
            {r.body ? (
              <details className="mt-2">
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent">
                  Read the email
                </summary>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-line bg-bg p-3">
                  {r.body}
                </p>
              </details>
            ) : (
              <p className="mt-1 text-sm text-muted">
                The text of this one wasn&apos;t saved.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function SentEmailsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link
        href="/settings"
        className="flex min-h-11 items-center text-muted underline"
      >
        ← Settings
      </Link>
      <h1 className="font-display text-4xl font-bold leading-none">
        Sent emails
      </h1>
      <Suspense fallback={<p className="text-muted">One sec…</p>}>
        <SentList />
      </Suspense>
    </main>
  );
}
