import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { googleConfig, revokeToken } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-crypto";
import { dateIn, formatLongDay } from "@/lib/format";

async function disconnectGoogle() {
  "use server";
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_connections")
    .select("refresh_token_enc")
    .eq("business_id", business.id)
    .maybeSingle();
  await supabase.from("google_connections").delete().eq("business_id", business.id);
  if (data) {
    try {
      await revokeToken(decryptToken(data.refresh_token_enc));
    } catch {
      // Unreadable key: nothing to hand back to Google. The connection is gone from Yarn anyway.
    }
  }
  redirect("/settings?google=disconnected");
}

const NOTES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Connected. Yarn can now use your Google Calendar." },
  disconnected: { ok: true, text: "Disconnected. Yarn can no longer see your Google Calendar." },
  denied: { ok: false, text: "No worries, nothing was connected. Google said you didn't allow it." },
  norefresh: {
    ok: false,
    text: "Google connected but didn't give Yarn lasting access. Tap Connect again and tick every box.",
  },
  notset: { ok: false, text: "Google isn't set up on the server yet." },
  failed: { ok: false, text: "That didn't work. Tap Connect and try once more." },
};

async function GoogleCard({ result }: { result?: string }) {
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("google_connections")
    .select("google_email, connected_at")
    .maybeSingle();
  const note = result ? NOTES[result] : undefined;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-display text-2xl font-bold leading-none">Google Calendar</h2>

      {note && (
        <p role="status" className={note.ok ? "text-invoice" : "text-variation"}>
          {note.text}
        </p>
      )}

      {connection ? (
        <>
          <p>
            <span className="font-semibold text-invoice">✓ Connected</span>
            {connection.google_email ? <> as <b>{connection.google_email}</b></> : null}
          </p>
          <p className="text-muted">
            Since {formatLongDay(dateIn(business.timezone, new Date(connection.connected_at)))}. Bookings
            go on your main calendar with a 30 minute reminder.
          </p>
          <form action={disconnectGoogle}>
            <button className="h-12 rounded-xl border border-line px-5 font-semibold">
              Disconnect
            </button>
          </form>
        </>
      ) : googleConfig() ? (
        <>
          <p className="text-muted">
            Connect once and your confirmed bookings go straight onto your main Google calendar, with a
            30 minute reminder.
          </p>
          {/* A plain link, not a Next.js Link: this must not be pre-loaded in the background. */}
          <a
            href="/api/google/connect"
            className="flex h-14 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
          >
            Connect Google Calendar
          </a>
          <p className="text-sm text-muted">
            Google will warn that it hasn&apos;t checked Yarn. That&apos;s normal for your own app: tap
            Advanced, then Go to Yarn.
          </p>
        </>
      ) : (
        <p className="text-muted">Google isn&apos;t set up on the server yet.</p>
      )}
    </section>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  return <GoogleCard result={google} />;
}

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <h1 className="font-display text-4xl font-bold leading-none">Settings</h1>
      <Suspense fallback={<p className="text-muted">One sec…</p>}>
        <Content searchParams={props.searchParams as Promise<{ google?: string }>} />
      </Suspense>
    </main>
  );
}
