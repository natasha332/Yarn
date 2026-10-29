"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatWhen } from "@/lib/format";
import {
  QUEUE_CHANGED,
  listPending,
  queueChanged,
  removePending,
  type PendingNote,
} from "@/lib/offline-queue";
import { afterSynced, syncAll, syncNote } from "@/lib/sync";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function LocalPlayer({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <audio controls src={url} className="w-full" />;
}

// Notes recorded on this phone that haven't reached Yarn yet (no signal, say).
// This also does the automatic uploading: when the app opens, when you come back to it,
// and the moment the phone gets signal again.
export default function PendingNotes({
  userId,
  timezone,
}: {
  userId: string;
  timezone: string;
}) {
  const router = useRouter();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [notes, setNotes] = useState<PendingNote[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setNotes(await listPending(userId).catch(() => []));
  }, [userId]);

  const syncEverything = useCallback(async () => {
    // With no signal there's nothing to send, but we still refresh what's on the screen.
    const made = navigator.onLine ? await syncAll(userId) : 0;
    await reload();
    if (made > 0) router.refresh();
  }, [userId, reload, router]);

  useEffect(() => {
    // Start just after the screen appears.
    const first = setTimeout(() => void syncEverything(), 0);

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncEverything();
    };
    const onQueue = () => void reload();
    window.addEventListener("online", syncEverything);
    window.addEventListener(QUEUE_CHANGED, onQueue);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", syncEverything);
      window.removeEventListener(QUEUE_CHANGED, onQueue);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, syncEverything]);

  async function tryNow(note: PendingNote) {
    setBusyId(note.id);
    setMessage(null);
    const result = await syncNote(note);
    if (result.ok) {
      await afterSynced(note.id);
      router.refresh();
    } else if (result.reason === "offline") {
      setMessage(
        "Still no signal. Yarn will upload it as soon as you're back online.",
      );
    } else if (result.reason === "error") {
      setMessage("Couldn't upload it just now. Try again in a moment.");
    }
    await reload();
    setBusyId(null);
  }

  async function discard(note: PendingNote) {
    if (
      !window.confirm("Delete this note from your phone? This can't be undone.")
    )
      return;
    setBusyId(note.id);
    setMessage(null);

    // If the recording already went up before the row did, take that file away too.
    if (note.uploadedPath) {
      const { error } = await createClient()
        .storage.from("audio")
        .remove([note.uploadedPath]);
      if (error) {
        setMessage("Couldn't delete it. Check your signal and try again.");
        setBusyId(null);
        return;
      }
    }
    await removePending(note.id).catch(() => {});
    queueChanged();
    setBusyId(null);
  }

  if (notes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl font-bold leading-none">
        Waiting to upload ({notes.length})
      </h2>
      {message && (
        <p role="alert" className="text-variation">
          {message}
        </p>
      )}
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {notes.map((n) => (
          <li
            key={n.id}
            className="flex flex-col gap-2 border-t border-line p-4 first:border-t-0"
          >
            <span className="font-mono text-xs tracking-wide text-muted">
              {formatWhen(n.createdAt, timezone)}
            </span>
            <p className="text-muted">
              {busyId === n.id
                ? "Uploading…"
                : online
                  ? "Safe on your phone. Yarn will keep trying."
                  : "Safe on your phone. Waiting for signal."}
            </p>
            <LocalPlayer blob={n.blob} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void tryNow(n)}
                disabled={busyId === n.id}
                className="h-12 flex-1 rounded-xl border border-line bg-surface font-semibold disabled:opacity-50"
              >
                Try now
              </button>
              <button
                type="button"
                onClick={() => void discard(n)}
                disabled={busyId === n.id}
                className="h-12 px-4 text-muted underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
