"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DateField from "../date-field";
import { formatClock, formatDay } from "@/lib/format";
import { syncBooking, syncNote } from "@/lib/google-sync";
import { showToast } from "@/lib/toast";

const inputClass =
  "h-12 rounded-xl border border-line bg-bg px-3 text-base font-normal";
const smallButton =
  "h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50";

// Reschedule and Cancel for a booking you've already confirmed.
export default function BookingActions({
  id,
  title,
  date,
  start,
  end,
  timezone,
  clientName,
  canEmail,
}: {
  id: string;
  title: string;
  date: string;
  start: string | null; // "09:00:00" from the database
  end: string | null;
  timezone: string;
  clientName: string | null;
  canEmail: boolean; // the client has an email address on file
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [newDate, setNewDate] = useState(date);
  const [newStart, setNewStart] = useState(start?.slice(0, 5) ?? "");
  const [newEnd, setNewEnd] = useState(end?.slice(0, 5) ?? "");
  const [dateOk, setDateOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = [formatDay(date), start && formatClock(start.slice(0, 5))]
    .filter(Boolean)
    .join(" · ");

  // Writes "let the client know" as a card in To check. It never sends anything itself.
  async function draftEmail(kind: "reschedule" | "cancel") {
    if (!canEmail) return "";
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: id,
          kind,
          oldDate: date,
          oldStart: start ? start.slice(0, 5) : null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (body?.status === "created" || body?.status === "exists") {
        return ` · email to ${clientName?.split(" ")[0] ?? "client"} is ready to check`;
      }
    } catch {
      // the move itself already worked; just no draft
    }
    return "";
  }

  async function reschedule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("reschedule_booking", {
      item_id: id,
      new_date: newDate,
      new_start: newStart || null,
      new_end: newEnd || null,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const nowWhen = [formatDay(newDate), newStart && formatClock(newStart)]
      .filter(Boolean)
      .join(" · ");
    const google = syncNote((await syncBooking(id, false)).status);
    const email = await draftEmail("reschedule");
    showToast(
      `✓ Moved “${title}” to ${nowWhen}${google ? ` · ${google}` : ""}${email}`,
    );
    setMoving(false);
    setBusy(false);
    router.refresh();
  }

  async function cancel() {
    if (!window.confirm(`Cancel “${title}” (${when})?`)) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("cancel_booking", {
      item_id: id,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const google = syncNote((await syncBooking(id, false)).status);
    const email = await draftEmail("cancel");
    showToast(`✓ Cancelled “${title}”${google ? ` · ${google}` : ""}${email}`);
    setBusy(false);
    router.refresh();
  }

  if (moving) {
    return (
      <form
        onSubmit={reschedule}
        className="mt-2 flex flex-col gap-3 rounded-xl border border-accent bg-bg p-3"
      >
        <DateField
          label="New day"
          value={newDate}
          onChange={(iso, ok) => {
            setNewDate(iso);
            setDateOk(ok && iso !== "");
          }}
          startOpen
          timezone={timezone}
          className="text-sm font-semibold"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
            Starts
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
            Ends
            <input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="text-variation">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !dateOk}
            className={`${smallButton} flex-1 bg-accent text-accent-ink`}
          >
            {busy ? "Saving…" : "Move it"}
          </button>
          <button
            type="button"
            onClick={() => setMoving(false)}
            disabled={busy}
            className={`${smallButton} border border-line bg-surface`}
          >
            Never mind
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-variation">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMoving(true)}
          disabled={busy}
          className={`${smallButton} border border-line bg-surface`}
        >
          Reschedule
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className={`${smallButton} px-2 text-muted underline`}
        >
          {busy ? "Cancelling…" : "Cancel booking"}
        </button>
      </div>
    </div>
  );
}
