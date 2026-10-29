"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Removes a note: the recording first, then the note itself.
// If anything goes wrong part way, nothing is left half-done: the note stays and you can try again.
export default function DeleteNote({
  captureId,
  audioPath,
}: {
  captureId: string;
  audioPath: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (
      !window.confirm(
        "Delete this note and its recording? This can't be undone.",
      )
    )
      return;

    setBusy(true);
    setError(null);
    const supabase = createClient();

    if (audioPath) {
      const { error } = await supabase.storage
        .from("audio")
        .remove([audioPath]);
      if (error) {
        setError("Couldn't delete it. Check your signal and try again.");
        setBusy(false);
        return;
      }
    }

    const { error } = await supabase
      .from("captures")
      .delete()
      .eq("id", captureId);
    if (error) {
      setError("Couldn't delete it. Check your signal and try again.");
      setBusy(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="flex h-11 items-center px-2 text-muted underline disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-variation">
          {error}
        </p>
      )}
    </div>
  );
}
