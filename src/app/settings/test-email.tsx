"use client";

import { useState } from "react";
import { showToast } from "@/lib/toast";

// "Send me a test": emails the real briefing or wrap-up now, so you can see what it looks like.
export default function TestEmail() {
  const [busy, setBusy] = useState<"morning" | "wrapup" | null>(null);

  async function send(kind: "morning" | "wrapup") {
    setBusy(kind);
    let message = "⚠ Couldn't send. Try again in a moment.";
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = await res.json().catch(() => null);
      if (body?.status === "sent")
        message = `✓ Sent to ${body.to}. Check your inbox (and spam).`;
      else if (body?.message) message = `⚠ ${body.message}`;
    } catch {
      // keep the default message
    }
    showToast(message);
    setBusy(null);
  }

  const button =
    "h-12 rounded-xl border border-line bg-surface px-4 font-semibold disabled:opacity-50";
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <p className="font-semibold">See what they look like</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => send("morning")}
          disabled={!!busy}
          className={button}
        >
          {busy === "morning" ? "Sending…" : "Send me a test briefing"}
        </button>
        <button
          type="button"
          onClick={() => send("wrapup")}
          disabled={!!busy}
          className={button}
        >
          {busy === "wrapup" ? "Sending…" : "Send me a test wrap-up"}
        </button>
      </div>
    </div>
  );
}
