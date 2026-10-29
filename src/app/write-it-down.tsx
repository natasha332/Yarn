"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// For a note that was saved but never got written down (a bad signal, say).
export default function WriteItDown({ captureId }: { captureId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captureId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Couldn't reach Yarn. Check your signal and try again.",
      );
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-variation">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="h-12 rounded-xl border border-line bg-surface px-4 font-semibold disabled:opacity-50"
      >
        {busy ? "Writing it down…" : "Write it down"}
      </button>
    </div>
  );
}
