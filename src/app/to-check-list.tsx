"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { announceCardsHandled } from "@/lib/card-events";
import DateField from "./date-field";
import { createClient } from "@/lib/supabase/client";
import {
  CARD_LABEL,
  CARD_TEXT_CLASS,
  type CardDetails,
  type PendingCard,
  type ToCheckGroup,
} from "@/lib/cards";
import { formatClock, formatDay, formatWhen } from "@/lib/format";
import { JOB_STATUSES, statusLabel } from "@/lib/jobs";

const inputClass =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base font-normal";
const bigButton = "h-12 rounded-xl px-4 font-semibold disabled:opacity-50";

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

// A card is ready to confirm when it has what it needs.
function needs(card: PendingCard): string | null {
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
        `✓ ${CARD_LABEL[card.type] ?? "Card"} confirmed: ${card.title}`,
      );
      router.refresh();
    }
    setBusy(null);
  }

  async function onConfirmAll(group: ToCheckGroup) {
    setBusy(`group:${group.key}`);
    setNotice(null);
    let done = 0;
    let repeats = 0;
    for (const card of [...group.cards].sort(
      (a, b) => a.position - b.position,
    )) {
      if (card.details.duplicate_of) {
        repeats++; // never confirm a possible repeat unless you decide to
        continue;
      }
      if (needs(card)) continue; // leave the ones that still need something
      if (!(await confirm(card))) break;
      done++;
    }
    const parts: string[] = [];
    if (done)
      parts.push(`✓ Confirmed ${done} ${done === 1 ? "card" : "cards"}`);
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
              busy={busy === card.id || busy === `group:${group.key}`}
              error={errors[card.id]}
              onConfirm={() => void onConfirm(card)}
              onDiscard={() => void onDiscard(card)}
              onChooseClient={(id) => void onChooseClient(card, id)}
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
  busy,
  error,
  onConfirm,
  onDiscard,
  onChooseClient,
  onSaved,
}: {
  card: PendingCard;
  timezone: string;
  busy: boolean;
  error: string | undefined;
  onConfirm: () => void;
  onDiscard: () => void;
  onChooseClient: (clientId: string) => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const d = card.details;
  const missing = needs(card);
  const when = [
    card.due_date && formatDay(card.due_date),
    card.start_time && formatClock(card.start_time),
  ]
    .filter(Boolean)
    .join(" · ");
  const options = card.client_id ? [] : (d.client_options ?? []);

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
        {CARD_LABEL[card.type] ?? card.type}
      </span>
      <h3 className="text-lg font-semibold leading-snug">{card.title}</h3>

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
      {card.type !== "job" && card.client_name && (
        <p className="text-muted">Client: {card.client_name}</p>
      )}
      {when && <p className="font-mono text-sm text-muted">{when}</p>}
      {d.address && <p className="text-muted">{d.address}</p>}
      {d.notes && <p className="text-muted">{d.notes}</p>}
      {missing && <p className="font-semibold text-variation">{missing}</p>}

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
              disabled={busy || !!missing}
              className={`${bigButton} flex-1 border border-line bg-surface`}
            >
              Keep anyway
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || !!missing}
              className={`${bigButton} flex-1 bg-ink text-surface`}
            >
              {busy ? "One sec…" : "Confirm"}
            </button>
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
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className={`${bigButton} border border-line bg-surface ${d.duplicate_of ? "flex-1" : ""}`}
        >
          Edit
        </button>
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
  const isCalendar = card.type === "calendar";
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
          label={isCalendar ? "Date" : "Due"}
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

      {(isCalendar || isJob) && (
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
