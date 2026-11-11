"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { announceCardsHandled } from "@/lib/card-events";
import DateField from "./date-field";
import { createClient } from "@/lib/supabase/client";
import {
  CARD_LABEL,
  CARD_TEXT_CLASS,
  type BookingSnapshot,
  type CardDetails,
  type PendingCard,
  type ToCheckGroup,
} from "@/lib/cards";
import { formatClock, formatDay, formatWhen } from "@/lib/format";
import { buildMailto, isEmail } from "@/lib/client-email";
import { syncBooking, syncToast } from "@/lib/google-sync";
import { showToast } from "@/lib/toast";
import { JOB_STATUSES, statusLabel } from "@/lib/jobs";

const inputClass =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base font-normal";
const bigButton = "h-12 rounded-xl px-4 font-semibold disabled:opacity-50";

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

// "Tue 3 Nov · 9:00am" (or just the day for an all-day booking)
function bookingWhen(date: string | null, start: string | null) {
  return [date && formatDay(date), start && formatClock(start.slice(0, 5))]
    .filter(Boolean)
    .join(" · ");
}

// A card is ready to confirm when it has what it needs.
function needs(card: PendingCard): string | null {
  if (card.type === "email") {
    const state = card.details.gmail?.state;
    if (state === "lookup") return "Finding their email in Gmail…";
    if (state === "choose") return "Choose which email to reply to";
    const to = card.details.email?.to;
    if (!to) return "Add an email address first";
    return isEmail(to) ? null : "That email address doesn't look right";
  }
  if (card.type === "reschedule" || card.type === "cancel") {
    if (!card.details.target_item_id) return "Choose which booking";
    if (card.type === "reschedule" && !card.due_date) return "Needs a new day";
    return null;
  }
  if (card.type === "calendar" && !card.due_date) return "Needs a date";
  if (
    card.type === "job" &&
    !card.client_id &&
    !card.details.new_client?.name?.trim()
  ) {
    return card.details.client_options?.length
      ? "Choose the client"
      : "Needs a client";
  }
  return null;
}

// The booking in Google Calendar that confirming this card adds or changes, if any.
function calendarTarget(card: PendingCard) {
  if (card.type === "calendar") return { id: card.id, create: true };
  if (
    (card.type === "reschedule" || card.type === "cancel") &&
    card.details.target_item_id
  ) {
    return { id: card.details.target_item_id, create: false };
  }
  return null;
}

// Sends an email card through the server. Returns an error message, or null when it went.
async function sendEmailCard(itemId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const body = await res.json().catch(() => null);
    if (body?.status === "sent") return null;
    return body?.message ?? "Couldn't send that. Try again.";
  } catch {
    return "Couldn't reach Yarn. Check your signal and try again.";
  }
}

// Saves a "reply to ..." card into Gmail as a draft. Returns an error message, or null when it worked.
async function saveGmailDraft(itemId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const body = await res.json().catch(() => null);
    if (body?.status === "saved") return null;
    return body?.message ?? "Couldn't save that draft. Try again.";
  } catch {
    return "Couldn't reach Yarn. Check your signal and try again.";
  }
}

export default function ToCheckList({
  groups,
  timezone,
}: {
  groups: ToCheckGroup[];
  timezone: string;
}) {
  const router = useRouter();
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null); // a card id, or "group:<key>"

  // A "reply to ..." card that has just appeared goes and finds the email in Gmail by itself.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const lookups = groups
      .flatMap((g) => g.cards)
      .filter(
        (c) =>
          c.type === "email" &&
          c.details.gmail?.state === "lookup" &&
          !asked.current.has(c.id),
      );
    if (!lookups.length) return;
    lookups.forEach((c) => asked.current.add(c.id));
    void Promise.all(
      lookups.map((c) =>
        fetch("/api/gmail/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: c.id }),
        }).catch(() => null),
      ),
    ).then(() => router.refresh());
  }, [groups, router]);

  function setError(id: string, message: string | null) {
    setErrors((e) => {
      const next = { ...e };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  async function confirm(card: PendingCard): Promise<boolean> {
    setError(card.id, null);
    if (card.type === "email") {
      const problem =
        card.details.gmail?.state === "ready"
          ? await saveGmailDraft(card.id)
          : await sendEmailCard(card.id);
      if (problem) {
        setError(card.id, problem);
        return false;
      }
      announceCardsHandled([card.id]);
      return true;
    }
    const { error } = await createClient().rpc("confirm_item", {
      item_id: card.id,
    });
    if (error) {
      setError(card.id, error.message);
      return false;
    }
    announceCardsHandled([card.id]);
    return true;
  }

  async function onConfirm(card: PendingCard) {
    setBusy(card.id);
    setNotice(null);
    if (await confirm(card)) {
      setNotice(
        card.type === "email" && card.details.gmail?.state === "ready"
          ? "✓ Saved to your Gmail drafts"
          : card.type === "email"
            ? `✓ Email sent to ${card.client_name ?? card.details.email?.to}`
            : `✓ ${CARD_LABEL[card.type] ?? "Card"} confirmed: ${card.title}`,
      );
      if (card.type === "email" && card.details.gmail?.state === "ready") {
        showToast("✓ Saved to your Gmail drafts. Open Gmail to send it.");
      }
      const target = calendarTarget(card);
      if (target) {
        // The pop-up, not the notice above: that disappears with the last card.
        const google = syncToast(
          (await syncBooking(target.id, target.create)).status,
        );
        if (google) showToast(google);
      }
      router.refresh();
    }
    setBusy(null);
  }

  async function onConfirmAll(group: ToCheckGroup) {
    setBusy(`group:${group.key}`);
    setNotice(null);
    let done = 0;
    let repeats = 0;
    let emailsLeft = 0;
    const targets: { id: string; create: boolean }[] = [];
    for (const card of [...group.cards].sort(
      (a, b) => a.position - b.position,
    )) {
      if (card.type === "email") {
        emailsLeft++; // an email only goes when you tap Send on it
        continue;
      }
      if (card.details.duplicate_of) {
        repeats++; // never confirm a possible repeat unless you decide to
        continue;
      }
      if (needs(card)) continue; // leave the ones that still need something
      if (!(await confirm(card))) break;
      done++;
      const target = calendarTarget(card);
      if (target) targets.push(target);
    }
    // Then bring Google Calendar into line, one booking at a time.
    let googled = 0;
    let googleFailed = 0;
    for (const t of targets) {
      const { status } = await syncBooking(t.id, t.create);
      if (status === "reconnect" || status === "error") googleFailed++;
      else if (syncToast(status)) googled++;
    }
    if (googleFailed) {
      showToast(
        `⚠ Google Calendar missed ${googleFailed}, tap Try again on Today`,
      );
    } else if (googled) {
      showToast("✓ Google Calendar updated");
    }
    const parts: string[] = [];
    if (done)
      parts.push(`✓ Confirmed ${done} ${done === 1 ? "card" : "cards"}`);
    if (emailsLeft) {
      parts.push(
        `${emailsLeft === 1 ? "1 email is" : `${emailsLeft} emails are`} waiting for you to send`,
      );
    }
    if (repeats) {
      parts.push(
        `skipped ${repeats} possible ${repeats === 1 ? "repeat" : "repeats"}`,
      );
    }
    if (parts.length) setNotice(parts.join(" · "));
    router.refresh();
    setBusy(null);
  }

  async function onDiscard(card: PendingCard) {
    setBusy(card.id);
    setNotice(null);
    const { error } = await createClient()
      .from("items")
      .update({ status: "discarded" })
      .eq("id", card.id);
    if (error)
      setError(
        card.id,
        "Couldn't discard it. Check your signal and try again.",
      );
    else {
      announceCardsHandled([card.id]);
      setNotice(`Discarded: ${card.title}`);
      router.refresh();
    }
    setBusy(null);
  }

  async function onDiscardAll(group: ToCheckGroup) {
    setBusy(`group:${group.key}`);
    setNotice(null);
    const { error } = await createClient()
      .from("items")
      .update({ status: "discarded" })
      .in(
        "id",
        group.cards.map((c) => c.id),
      );
    if (error) {
      setError(
        group.cards[0].id,
        "Couldn't discard them. Check your signal and try again.",
      );
    } else {
      announceCardsHandled(group.cards.map((c) => c.id));
      setNotice(
        `Discarded the repeat (${group.cards.length} ${group.cards.length === 1 ? "card" : "cards"})`,
      );
      router.refresh();
    }
    setBusy(null);
  }

  async function onChooseBooking(card: PendingCard, booking: BookingSnapshot) {
    setBusy(card.id);
    const { error } = await createClient()
      .from("items")
      .update({
        details: {
          ...card.details,
          target_item_id: booking.id,
          target: booking,
          target_options: [],
        },
      })
      .eq("id", card.id);
    if (error) setError(card.id, "Couldn't save that choice. Try again.");
    else router.refresh();
    setBusy(null);
  }

  // "Open in my email app": remember that she did, so the card can ask whether she sent it.
  async function onHandOff(card: PendingCard) {
    const { error } = await createClient()
      .from("items")
      .update({
        details: { ...card.details, handed_off_at: new Date().toISOString() },
      })
      .eq("id", card.id);
    if (!error) router.refresh();
  }

  async function onMarkSent(card: PendingCard) {
    setBusy(card.id);
    setNotice(null);
    const { error } = await createClient()
      .from("items")
      .update({ status: "confirmed" })
      .eq("id", card.id)
      .eq("status", "pending");
    if (error) {
      setError(card.id, "Couldn't save that. Check your signal and try again.");
    } else {
      announceCardsHandled([card.id]);
      setNotice(`✓ Marked as sent: ${card.title}`);
      router.refresh();
    }
    setBusy(null);
  }

  async function onChooseEmail(card: PendingCard, threadId: string) {
    setBusy(card.id);
    setError(card.id, null);
    try {
      const res = await fetch("/api/gmail/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: card.id, threadId }),
      });
      await res.json().catch(() => null);
    } catch {
      setError(
        card.id,
        "Couldn't reach Yarn. Check your signal and try again.",
      );
    }
    router.refresh();
    setBusy(null);
  }

  async function onChooseClient(card: PendingCard, clientId: string) {
    setBusy(card.id);
    const { error } = await createClient()
      .from("items")
      .update({ client_id: clientId })
      .eq("id", card.id);
    if (error) setError(card.id, "Couldn't save that choice. Try again.");
    else router.refresh();
    setBusy(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl font-bold leading-none">
        To check ({total})
      </h2>
      {notice && (
        <p role="status" className="font-semibold text-invoice">
          {notice}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs tracking-wide text-muted">
              From your note · {formatWhen(group.when, timezone)}
            </span>
            {group.cards.every((c) => c.details.duplicate_of) ? (
              <button
                type="button"
                onClick={() => void onDiscardAll(group)}
                disabled={busy !== null}
                className="h-11 shrink-0 whitespace-nowrap rounded-xl bg-ink px-3 text-sm font-semibold text-surface disabled:opacity-50"
              >
                {busy === `group:${group.key}` ? "Discarding…" : "Discard all"}
              </button>
            ) : (
              group.cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => void onConfirmAll(group)}
                  disabled={busy !== null}
                  className="h-11 shrink-0 whitespace-nowrap rounded-xl border border-line bg-surface px-3 text-sm font-semibold disabled:opacity-50"
                >
                  {busy === `group:${group.key}`
                    ? "Confirming…"
                    : "Confirm all"}
                </button>
              )
            )}
          </div>

          {group.cards.map((card) => (
            <CardView
              key={card.id}
              card={card}
              timezone={timezone}
              waitingForChange={
                !!card.details.goes_with_item_id &&
                group.cards.some((c) => c.id === card.details.goes_with_item_id)
              }
              busy={busy === card.id || busy === `group:${group.key}`}
              error={errors[card.id]}
              onConfirm={() => void onConfirm(card)}
              onDiscard={() => void onDiscard(card)}
              onChooseClient={(id) => void onChooseClient(card, id)}
              onChooseBooking={(b) => void onChooseBooking(card, b)}
              onChooseEmail={(threadId) => void onChooseEmail(card, threadId)}
              onHandOff={() => void onHandOff(card)}
              onMarkSent={() => void onMarkSent(card)}
              onSaved={() => {
                setNotice(null);
                router.refresh();
              }}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function CardView({
  card,
  timezone,
  waitingForChange,
  busy,
  error,
  onConfirm,
  onDiscard,
  onChooseClient,
  onChooseBooking,
  onChooseEmail,
  onHandOff,
  onMarkSent,
  onSaved,
}: {
  card: PendingCard;
  timezone: string;
  waitingForChange: boolean;
  busy: boolean;
  error: string | undefined;
  onConfirm: () => void;
  onDiscard: () => void;
  onChooseClient: (clientId: string) => void;
  onChooseBooking: (booking: BookingSnapshot) => void;
  onChooseEmail: (threadId: string) => void;
  onHandOff: () => void;
  onMarkSent: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const gm = card.type === "email" ? card.details.gmail : null;
  const gmailDraft = gm?.state === "ready"; // "Save to Gmail drafts" instead of "Send email"
  const mailto =
    card.type === "email" && !gmailDraft && card.details.email
      ? buildMailto(card.details.email)
      : null;
  const isChange = card.type === "reschedule" || card.type === "cancel";
  const d = card.details;
  const missing = needs(card);
  const when = [
    card.due_date && formatDay(card.due_date),
    card.start_time && formatClock(card.start_time),
  ]
    .filter(Boolean)
    .join(" · ");
  const options = card.client_id ? [] : (d.client_options ?? []);

  if (editing && card.type === "email") {
    return (
      <EditEmail
        card={card}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onSaved();
        }}
      />
    );
  }
  if (editing) {
    return (
      <EditCard
        card={card}
        timezone={timezone}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onSaved();
        }}
      />
    );
  }

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <span
        className={`text-xs font-bold uppercase tracking-wide ${CARD_TEXT_CLASS[card.type] ?? ""}`}
      >
        {card.type === "email"
          ? `Email to ${card.client_name ?? "client"}`
          : (CARD_LABEL[card.type] ?? card.type)}
      </span>
      <h3 className="text-lg font-semibold leading-snug">{card.title}</h3>

      {gm?.state === "lookup" && (
        <p className="font-semibold text-todo">
          Finding {card.client_name ?? "their"} email in your Gmail…
        </p>
      )}
      {gm?.state === "choose" && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Which email?</p>
          <div className="flex flex-col gap-2">
            {(gm.candidates ?? []).map((c) => (
              <button
                key={c.threadId}
                type="button"
                onClick={() => onChooseEmail(c.threadId)}
                disabled={busy}
                className="flex min-h-12 flex-col items-start rounded-xl border border-line bg-bg px-4 py-2 text-left font-semibold disabled:opacity-50"
              >
                <span>{c.subject}</span>
                <span className="font-mono text-xs font-normal text-muted">
                  {c.fromName || c.fromAddress} ·{" "}
                  {formatDay(c.date.slice(0, 10))}
                </span>
                {c.snippet && (
                  <span className="text-sm font-normal text-muted">
                    {c.snippet}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {(gm?.state === "none" || gm?.state === "error") && gm.message && (
        <p className="font-semibold text-todo">{gm.message}</p>
      )}
      {gmailDraft && gm?.subject && (
        <p className="text-muted">
          Replying to:{" "}
          <span className="font-semibold text-ink">{gm.subject}</span>
        </p>
      )}
      {card.type === "email" &&
        d.email &&
        gm?.state !== "lookup" &&
        gm?.state !== "choose" && (
          <div className="flex flex-col gap-2">
            <p className="text-muted">
              To:{" "}
              <span
                className={
                  d.email.to
                    ? "font-mono text-sm"
                    : "font-semibold text-variation"
                }
              >
                {d.email.to ?? "no email address yet"}
              </span>
            </p>
            <p className="whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 text-base">
              {d.email.body}
            </p>
            <p className="text-sm text-muted">
              {gmailDraft
                ? "This goes into your Gmail drafts, in the same conversation. You press Send in Gmail."
                : "Send emails from Yarn (in your business name), or open it in your own email app."}
            </p>
            {d.handed_off_at && (
              <p className="font-semibold text-todo">
                Opened in your email app. Send it there, then tap Done.
              </p>
            )}
          </div>
        )}

      {isChange && d.target && (
        <div className="flex flex-col gap-0.5">
          {card.type === "reschedule" ? (
            <>
              <p className="text-muted">
                Now:{" "}
                <span className="font-mono text-sm">
                  {bookingWhen(d.target.date, d.target.start)}
                </span>
              </p>
              <p className="font-semibold">
                Move to:{" "}
                <span className="font-mono text-sm">
                  {bookingWhen(
                    card.due_date,
                    card.start_time?.slice(0, 5) ?? null,
                  )}
                  {card.end_time && card.start_time
                    ? ` until ${formatClock(card.end_time.slice(0, 5))}`
                    : ""}
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-muted">
                Booked for:{" "}
                <span className="font-mono text-sm">
                  {bookingWhen(d.target.date, d.target.start)}
                </span>
              </p>
              <p className="text-muted">
                It will be taken off Today and your calendar.
              </p>
            </>
          )}
          {d.target.client && (
            <p className="text-muted">Client: {d.target.client}</p>
          )}
        </div>
      )}

      {card.type === "job" && (
        <p className="text-muted">
          {card.client_id
            ? `Client: ${card.client_name ?? "existing client"}`
            : d.new_client?.name
              ? `Client: ${d.new_client.name} (new client)`
              : "Client: not chosen yet"}
          {" · "}
          {statusLabel(d.job_status ?? "consultation")}
        </p>
      )}
      {card.type !== "job" && !isChange && card.client_name && (
        <p className="text-muted">Client: {card.client_name}</p>
      )}
      {when && !isChange && (
        <p className="font-mono text-sm text-muted">{when}</p>
      )}
      {d.address && <p className="text-muted">{d.address}</p>}
      {d.notes && <p className="text-muted">{d.notes}</p>}
      {missing && <p className="font-semibold text-variation">{missing}</p>}
      {waitingForChange && (
        <p className="font-semibold text-todo">
          Confirm the change above first, then send this.
        </p>
      )}

      {d.duplicate_of && (
        <p
          role="note"
          className="rounded-lg border border-todo bg-bg p-3 font-semibold text-todo"
        >
          ⚠ Looks like a repeat of {d.duplicate_of.label}
        </p>
      )}

      {options.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Which client?</p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onChooseClient(o.id)}
                disabled={busy}
                className="h-12 rounded-xl border border-line bg-bg px-4 font-semibold disabled:opacity-50"
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isChange && !d.target_item_id && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Which booking?</p>
          {(d.target_options ?? []).length === 0 && (
            <p className="text-muted">
              I couldn&apos;t find a booking to change. Confirmed bookings show
              here.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {(d.target_options ?? []).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onChooseBooking(b)}
                disabled={busy}
                className="flex min-h-12 flex-col items-start rounded-xl border border-line bg-bg px-4 py-2 text-left font-semibold disabled:opacity-50"
              >
                <span>{b.title}</span>
                <span className="font-mono text-xs font-normal text-muted">
                  {bookingWhen(b.date, b.start)}
                  {b.client ? ` · ${b.client}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-variation">
          {error}
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-2">
        {d.duplicate_of ? (
          <>
            <button
              type="button"
              onClick={onDiscard}
              disabled={busy}
              className={`${bigButton} w-full bg-ink text-surface`}
            >
              {busy ? "One sec…" : "Discard repeat"}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || !!missing || waitingForChange}
              className={`${bigButton} flex-1 border border-line bg-surface`}
            >
              {card.type === "email" ? "Send anyway" : "Keep anyway"}
            </button>
          </>
        ) : (
          <>
            {gm?.state !== "lookup" && gm?.state !== "choose" && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy || !!missing || waitingForChange}
                className={`${bigButton} flex-1 bg-ink text-surface`}
              >
                {busy
                  ? card.type === "email"
                    ? gmailDraft
                      ? "Saving…"
                      : "Sending…"
                    : "One sec…"
                  : card.type === "email"
                    ? gmailDraft
                      ? "Save to Gmail drafts"
                      : "Send email"
                    : "Confirm"}
              </button>
            )}
            <button
              type="button"
              onClick={onDiscard}
              disabled={busy}
              className={`${bigButton} px-3 text-muted underline`}
            >
              Discard
            </button>
          </>
        )}
        {card.type !== "cancel" && gm?.state !== "lookup" && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className={`${bigButton} border border-line bg-surface ${d.duplicate_of ? "flex-1" : ""}`}
          >
            Edit
          </button>
        )}
        {card.type === "email" && mailto && !waitingForChange && (
          <a
            href={mailto}
            onClick={onHandOff}
            className={`${bigButton} flex w-full items-center justify-center border border-line bg-surface`}
          >
            Open in my email app
          </a>
        )}
        {card.type === "email" && d.handed_off_at && (
          <button
            type="button"
            onClick={onMarkSent}
            disabled={busy}
            className={`${bigButton} w-full border border-line bg-surface`}
          >
            Done, I sent it
          </button>
        )}
      </div>
    </article>
  );
}

function EditCard({
  card,
  timezone,
  onCancel,
  onSaved,
}: {
  card: PendingCard;
  timezone: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const d = card.details;
  const [title, setTitle] = useState(card.title);
  const [date, setDate] = useState(card.due_date ?? "");
  const [start, setStart] = useState(hhmm(card.start_time));
  const [end, setEnd] = useState(hhmm(card.end_time));
  const [address, setAddress] = useState(d.address ?? "");
  const [notes, setNotes] = useState(d.notes ?? "");
  const [clientName, setClientName] = useState(d.new_client?.name ?? "");
  const [clientPhone, setClientPhone] = useState(d.new_client?.phone ?? "");
  const [status, setStatus] = useState(d.job_status ?? "consultation");
  const [dateOk, setDateOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isJob = card.type === "job";
  const isMove = card.type === "reschedule";
  const isCalendar = card.type === "calendar" || isMove; // has a date and times
  const hasDate =
    isCalendar || card.type === "todo" || card.type === "followup";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const details: CardDetails = {
      ...d,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    if (isJob) {
      details.job_status = status;
      if (!card.client_id) {
        details.new_client = clientName.trim()
          ? {
              ...(d.new_client ?? { nicknames: [] }),
              name: clientName.trim(),
              phone: clientPhone.trim() || null,
            }
          : null;
      }
    }

    const { error } = await createClient()
      .from("items")
      .update({
        title: title.trim() || card.title,
        due_date: hasDate ? date || null : card.due_date,
        start_time: isCalendar ? start || null : card.start_time,
        end_time: isCalendar ? end || null : card.end_time,
        details,
      })
      .eq("id", card.id);

    if (error) {
      setError("Couldn't save that. Check your signal and try again.");
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 rounded-xl border border-accent bg-surface p-4"
    >
      <span
        className={`text-xs font-bold uppercase tracking-wide ${CARD_TEXT_CLASS[card.type] ?? ""}`}
      >
        Editing · {CARD_LABEL[card.type] ?? card.type}
      </span>

      <label className="flex flex-col gap-1 font-semibold">
        {isJob ? "Job name" : "Title"}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className={inputClass}
        />
      </label>

      {isJob &&
        (card.client_id ? (
          <p className="text-muted">
            Client: {card.client_name ?? "existing client"}
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 font-semibold">
              Client name
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Client phone
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className={inputClass}
              />
            </label>
          </>
        ))}

      {isJob && (
        <label className="flex flex-col gap-1 font-semibold">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${inputClass} px-2`}
          >
            {JOB_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {hasDate && (
        <DateField
          label={isMove ? "New day" : isCalendar ? "Date" : "Due"}
          value={date}
          onChange={(iso, ok) => {
            setDate(iso);
            setDateOk(ok);
          }}
          optional={!isCalendar}
          timezone={timezone}
          className="font-semibold"
        />
      )}

      {isCalendar && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1 font-semibold">
            Starts
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 font-semibold">
            Ends
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      )}

      {(card.type === "calendar" || isJob) && (
        <label className="flex flex-col gap-1 font-semibold">
          {isJob ? "Job address" : "Where"}
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </label>
      )}

      {!isJob && !isCalendar && (
        <label className="flex flex-col gap-1 font-semibold">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-base font-normal"
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-variation">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !dateOk}
          className={`${bigButton} flex-1 bg-accent text-accent-ink`}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={`${bigButton} border border-line bg-surface`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditEmail({
  card,
  onCancel,
  onSaved,
}: {
  card: PendingCard;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const d = card.details;
  const [to, setTo] = useState(d.email?.to ?? "");
  const [subject, setSubject] = useState(d.email?.subject ?? card.title);
  const [body, setBody] = useState(d.email?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (to.trim() && !isEmail(to)) {
      setError("That email address doesn't look right.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("The email needs a subject and a message.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from("items")
      .update({
        title: subject.trim().slice(0, 200),
        details: {
          ...d,
          send_error: null,
          email: {
            kind: d.email?.kind ?? "other",
            to: to.trim() || null,
            subject: subject.trim().slice(0, 200),
            body: body.trim(),
          },
        },
      })
      .eq("id", card.id);
    if (error) {
      setError("Couldn't save that. Check your signal and try again.");
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 rounded-xl border border-accent bg-surface p-4"
    >
      <span
        className={`text-xs font-bold uppercase tracking-wide ${CARD_TEXT_CLASS.email}`}
      >
        Editing · Email to {card.client_name ?? "client"}
      </span>
      <label className="flex flex-col gap-1 font-semibold">
        To
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="name@example.com"
          autoComplete="off"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Message
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          maxLength={5000}
          className="rounded-xl border border-line bg-bg px-3 py-2 text-base font-normal"
        />
      </label>
      {error && (
        <p role="alert" className="text-variation">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className={`${bigButton} flex-1 bg-accent text-accent-ink`}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={`${bigButton} border border-line bg-surface`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
