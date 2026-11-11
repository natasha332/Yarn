import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { googleConfig, revokeToken } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-crypto";
import { dateIn, formatDay, formatLongDay } from "@/lib/format";
import { isEmail } from "@/lib/client-email";
import { senderAddress } from "@/lib/resend";
import Flash from "./flash";
import NotificationSetup from "./notification-setup";
import TestEmail from "./test-email";

async function disconnectGoogle() {
  "use server";
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_connections")
    .select("refresh_token_enc")
    .eq("business_id", business.id)
    .maybeSingle();
  await supabase
    .from("google_connections")
    .delete()
    .eq("business_id", business.id);
  if (data) {
    try {
      await revokeToken(decryptToken(data.refresh_token_enc));
    } catch {
      // Unreadable key: nothing to hand back to Google. The connection is gone from Yarn anyway.
    }
  }
  redirect("/settings?google=disconnected");
}

async function saveBriefing(formData: FormData) {
  "use server";
  const business = await requireBusiness();
  const time = (key: string) => {
    const value = String(formData.get(key) ?? "");
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
  };
  const morning = time("morning_time");
  const wrapup = time("wrapup_time");
  if (!morning || !wrapup) redirect("/settings?saved=badtime");

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      notify_channel: ["email", "push", "both"].includes(
        String(formData.get("channel")),
      )
        ? String(formData.get("channel"))
        : "email",
      morning_enabled: formData.get("morning_on") === "on",
      morning_email_time: morning,
      wrapup_mode: formData.get("wrapup_on") === "on" ? "end_of_day" : "off",
      wrapup_time: wrapup,
    })
    .eq("id", business.id);
  redirect(`/settings?saved=${error ? "failed" : "ok"}`);
}

async function saveEmailIdentity(formData: FormData) {
  "use server";
  const business = await requireBusiness();
  const text = (key: string, max: number) =>
    String(formData.get(key) ?? "")
      .trim()
      .slice(0, max);
  const replyTo = text("reply_to", 254);
  if (replyTo && !isEmail(replyTo)) redirect("/settings?saved=badreply");

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      email_from_name: text("from_name", 80) || null,
      email_reply_to: replyTo || null,
      email_sign_off: text("sign_off", 500) || null,
      email_copy_to_me: formData.get("copy_to_me") === "on",
    })
    .eq("id", business.id);
  redirect(`/settings?saved=${error ? "failed" : "ok"}`);
}

const SAVED: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "Saved." },
  badreply: {
    ok: false,
    text: "That reply-to email address doesn't look right.",
  },
  badtime: { ok: false, text: "Pick a time for each one, then save again." },
  failed: { ok: false, text: "That didn't save. Try once more." },
};

async function disconnectGmail() {
  "use server";
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("gmail_connections")
    .select("refresh_token_enc")
    .eq("business_id", business.id)
    .maybeSingle();
  await supabase
    .from("gmail_connections")
    .delete()
    .eq("business_id", business.id);
  if (data) {
    try {
      await revokeToken(decryptToken(data.refresh_token_enc));
    } catch {
      // Unreadable key: nothing to hand back to Google. The connection is gone from Yarn anyway.
    }
  }
  redirect("/settings?gmail=disconnected");
}

const NOTES: Record<string, { ok: boolean; text: string }> = {
  connected: {
    ok: true,
    text: "Connected. Yarn can now use your Google Calendar.",
  },
  disconnected: {
    ok: true,
    text: "Disconnected. Yarn can no longer see your Google Calendar.",
  },
  gmail_connected: {
    ok: true,
    text: "Gmail connected. Yarn can now find emails to reply to.",
  },
  gmail_disconnected: {
    ok: true,
    text: "Gmail disconnected. Yarn can no longer see your email.",
  },
  denied: {
    ok: false,
    text: "No worries, nothing was connected. Google said you didn't allow it.",
  },
  norefresh: {
    ok: false,
    text: "Google connected but didn't give Yarn lasting access. Tap Connect again and tick every box.",
  },
  notset: { ok: false, text: "Google isn't set up on the server yet." },
  failed: {
    ok: false,
    text: "That didn't work. Tap Connect and try once more.",
  },
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
      <h2 className="font-display text-2xl font-bold leading-none">
        Google Calendar
      </h2>

      {note && (
        <p
          role="status"
          className={note.ok ? "text-invoice" : "text-variation"}
        >
          {note.text}
        </p>
      )}

      {connection ? (
        <>
          <p>
            <span className="font-semibold text-invoice">✓ Connected</span>
            {connection.google_email ? (
              <>
                {" "}
                as <b>{connection.google_email}</b>
              </>
            ) : null}
          </p>
          <p className="text-muted">
            Since{" "}
            {formatLongDay(
              dateIn(business.timezone, new Date(connection.connected_at)),
            )}
            . Bookings go on your main calendar with a 30 minute reminder.
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
            Connect once and your confirmed bookings go straight onto your main
            Google calendar, with a 30 minute reminder.
          </p>
          {/* A plain link, not a Next.js Link: this must not be pre-loaded in the background. */}
          <a
            href="/api/google/connect"
            className="flex h-14 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
          >
            Connect Google Calendar
          </a>
          <p className="text-sm text-muted">
            Google will warn that it hasn&apos;t checked Yarn. That&apos;s
            normal for your own app: tap Advanced, then Go to Yarn.
          </p>
        </>
      ) : (
        <p className="text-muted">
          Google isn&apos;t set up on the server yet.
        </p>
      )}
    </section>
  );
}

const hhmm = (t: string | null | undefined, fallback: string) =>
  (t ?? fallback).slice(0, 5);

async function BriefingCard() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const [{ data: settings }, { data: google }, { data: auth }, { data: log }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select(
          "morning_enabled, morning_email_time, wrapup_mode, wrapup_time, notify_channel",
        )
        .eq("id", business.id)
        .maybeSingle(),
      supabase.from("google_connections").select("google_email").maybeSingle(),
      supabase.auth.getUser(),
      supabase
        .from("digest_log")
        .select("kind, local_date, status")
        .order("local_date", { ascending: false })
        .order("claimed_at", { ascending: false })
        .limit(10),
    ]);
  const lastOf = (kind: string) => log?.find((row) => row.kind === kind);
  const lastLine = (
    label: string,
    row?: { local_date: string; status: string },
  ) => {
    if (!row) return `${label}: not sent yet`;
    const when = formatDay(row.local_date);
    if (row.status === "sent") return `${label}: ✓ sent ${when}`;
    if (row.status === "failed")
      return `${label}: ⚠ ${when} didn't send, will try again`;
    if (row.status === "skipped")
      return `${label}: ⚠ ${when} skipped, no email address`;
    return `${label}: sending ${when}…`;
  };
  // Emails go to the Google account the calendar is connected to, or the login email if there isn't one.
  const sendTo = google?.google_email ?? auth.user?.email ?? null;
  const box =
    "h-12 rounded-xl border border-line bg-bg px-3 text-base font-normal";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-display text-2xl font-bold leading-none">
        Daily briefing
      </h2>

      <form action={saveBriefing} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">
            How should it reach you?
          </legend>
          {(
            [
              ["email", "Email"],
              ["push", "Notification on my phone"],
              ["both", "Both"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className="flex min-h-12 items-center gap-3 font-semibold"
            >
              <input
                type="radio"
                name="channel"
                value={value}
                defaultChecked={(settings?.notify_channel ?? "email") === value}
                className="h-6 w-6 shrink-0 accent-[var(--accent)]"
              />
              {text}
            </label>
          ))}
          <p className="text-sm text-muted">
            Notifications need to be turned on for your phone (just below). If a
            notification can&apos;t reach you, Yarn emails it instead.
          </p>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input
              type="checkbox"
              name="morning_on"
              defaultChecked={settings?.morning_enabled ?? true}
              className="h-6 w-6 accent-[var(--accent)]"
            />
            Morning briefing
          </label>
          <p className="text-muted">
            Today&apos;s bookings, to-dos and anything waiting for you to check.
          </p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Send at
            <input
              type="time"
              name="morning_time"
              required
              defaultValue={hhmm(settings?.morning_email_time, "07:00")}
              className={box}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input
              type="checkbox"
              name="wrapup_on"
              defaultChecked={(settings?.wrapup_mode ?? "end_of_day") !== "off"}
              className="h-6 w-6 accent-[var(--accent)]"
            />
            Day wrap-up
          </label>
          <p className="text-muted">
            What got done, what&apos;s still open, and tomorrow&apos;s bookings.
          </p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Send at
            <input
              type="time"
              name="wrapup_time"
              required
              defaultValue={hhmm(settings?.wrapup_time, "17:00")}
              className={box}
            />
          </label>
        </div>

        <p className="text-muted">
          Times are in your business timezone ({business.timezone}).{" "}
          {sendTo ? (
            <>
              Emails go to <b className="text-ink">{sendTo}</b>.
            </>
          ) : null}
        </p>

        <button className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink">
          Save
        </button>
      </form>

      <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-muted">
        <p className="font-semibold text-ink">Last sent</p>
        <p>{lastLine("Morning briefing", lastOf("morning"))}</p>
        <p>{lastLine("Day wrap-up", lastOf("wrapup"))}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="font-semibold">Notifications on this phone</p>
        <NotificationSetup publicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
      </div>

      <TestEmail />
    </section>
  );
}

async function ClientEmailCard() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const [{ data: settings }, { data: auth }, { data: person }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select(
          "email_from_name, email_reply_to, email_sign_off, email_copy_to_me",
        )
        .eq("id", business.id)
        .maybeSingle(),
      supabase.auth.getUser(),
      supabase.from("users").select("name").maybeSingle(),
    ]);
  const box =
    "h-12 rounded-xl border border-line bg-bg px-3 text-base font-normal";
  const loginEmail = auth.user?.email ?? "";
  const defaultSignOff = [person?.name, business.name]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-display text-2xl font-bold leading-none">
        Emails to clients
      </h2>
      <p className="text-muted">
        When Yarn writes to a client for you (like &quot;your booking has
        moved&quot;), you read it and tap Send. It goes out as{" "}
        <b className="text-ink">{settings?.email_from_name || business.name}</b>{" "}
        from <span className="font-mono text-sm">{senderAddress()}</span>, and
        their replies come to you.
      </p>
      <form action={saveEmailIdentity} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Name clients see
          <input
            name="from_name"
            maxLength={80}
            defaultValue={settings?.email_from_name ?? ""}
            placeholder={business.name}
            className={box}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Send their replies to
          <input
            name="reply_to"
            type="email"
            maxLength={254}
            defaultValue={settings?.email_reply_to ?? ""}
            placeholder={loginEmail}
            className={box}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Sign-off
          <textarea
            name="sign_off"
            rows={3}
            maxLength={500}
            defaultValue={settings?.email_sign_off ?? ""}
            placeholder={defaultSignOff}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-base font-normal"
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            name="copy_to_me"
            defaultChecked={settings?.email_copy_to_me ?? true}
            className="h-6 w-6 shrink-0 accent-[var(--accent)]"
          />
          Send me a copy of every email Yarn sends
        </label>
        <p className="-mt-2 text-sm text-muted">
          The copy goes to your reply-to address, so you can read what your
          client got. It arrives in your inbox, not your Sent folder.
        </p>
        <button className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink">
          Save
        </button>
      </form>
      <Link
        href="/settings/sent"
        className="flex min-h-12 items-center font-semibold text-accent underline"
      >
        See the emails Yarn has sent →
      </Link>
    </section>
  );
}

async function GmailCard() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("google_email, connected_at")
    .maybeSingle();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-display text-2xl font-bold leading-none">Gmail</h2>
      {connection ? (
        <>
          <p>
            <span className="font-semibold text-invoice">✓ Connected</span>
            {connection.google_email ? (
              <>
                {" "}
                as <b>{connection.google_email}</b>
              </>
            ) : null}
          </p>
          <p className="text-muted">
            Since{" "}
            {formatLongDay(
              dateIn(business.timezone, new Date(connection.connected_at)),
            )}
            . Say &quot;reply to Robyn&quot; and Yarn finds her email, writes
            the reply and saves it in your Gmail drafts. It can read mail and
            make drafts. It can&apos;t send anything.
          </p>
          <form action={disconnectGmail}>
            <button className="h-12 rounded-xl border border-line px-5 font-semibold">
              Disconnect Gmail
            </button>
          </form>
        </>
      ) : googleConfig() ? (
        <>
          <p className="text-muted">
            Connect Gmail and Yarn can find an email you want to reply to, even
            if you haven&apos;t saved the client&apos;s address, and save your
            reply as a draft in Gmail. You press Send yourself.
          </p>
          {/* A plain link, not a Next.js Link: this must not be pre-loaded in the background. */}
          <a
            href="/api/gmail/connect"
            className="flex h-14 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
          >
            Connect Gmail
          </a>
          <p className="text-sm text-muted">
            Yarn only reads the emails it needs for a reply you ask for, and it
            can&apos;t send or delete anything.
          </p>
        </>
      ) : (
        <p className="text-muted">
          Google isn&apos;t set up on the server yet.
        </p>
      )}
    </section>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; saved?: string; gmail?: string }>;
}) {
  const { google, saved, gmail } = await searchParams;
  const flash = saved
    ? SAVED[saved]
    : gmail
      ? (NOTES[`gmail_${gmail}`] ?? NOTES[gmail])
      : google
        ? NOTES[google]
        : undefined;
  return (
    <>
      <Flash message={flash ? `${flash.ok ? "✓" : "⚠"} ${flash.text}` : null} />
      <GoogleCard result={google} />
      <GmailCard />
      <BriefingCard />
      <ClientEmailCard />
    </>
  );
}

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <h1 className="font-display text-4xl font-bold leading-none">Settings</h1>
      <Suspense fallback={<p className="text-muted">One sec…</p>}>
        <Content
          searchParams={
            props.searchParams as Promise<{
              google?: string;
              saved?: string;
              gmail?: string;
            }>
          }
        />
      </Suspense>
    </main>
  );
}
