"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncBooking, syncNote } from "@/lib/google-sync";
import { showToast } from "@/lib/toast";

// A small line under a booking: is it in Google Calendar? With a button to fix it if not.
export default function GoogleStatus({
  id,
  state,
}: {
  id: string;
  state: "synced" | "behind" | "missing";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function fix() {
    setBusy(true);
    const { status, message } = await syncBooking(id, state === "missing");
    showToast(
      syncNote(status)
        ? `✓ ${syncNote(status)}`
        : (message ?? "Already up to date in Google Calendar"),
    );
    setBusy(false);
    router.refresh();
  }

  if (state === "synced") {
    return <p className="font-mono text-xs text-muted">✓ In Google Calendar</p>;
  }
  return (
    <div className="flex items-center gap-3">
      <p className="font-mono text-xs text-muted">
        {state === "missing"
          ? "Not in Google Calendar"
          : "Google Calendar hasn't caught up"}
      </p>
      <button
        type="button"
        onClick={fix}
        disabled={busy}
        className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "One sec…" : state === "missing" ? "Add" : "Try again"}
      </button>
    </div>
  );
}
