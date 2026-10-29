// Gets waiting notes from the phone up into Yarn's cloud.
// Only ever used from the browser.

import { createClient } from "@/lib/supabase/client";
import {
  NOTE_SYNCED,
  listPending,
  putPending,
  queueChanged,
  removePending,
  type PendingNote,
} from "./offline-queue";

export type SyncResult =
  | { ok: true }
  | { ok: false; reason: "offline" | "error" | "busy" };

// Notes being uploaded right now, so two things never upload the same note at once.
const inFlight = new Set<string>();

function extensionFor(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function failed(): SyncResult {
  queueChanged();
  return { ok: false, reason: navigator.onLine ? "error" : "offline" };
}

// Upload the audio, then add the capture row. Safe to run again after any failure.
export async function syncNote(note: PendingNote): Promise<SyncResult> {
  if (inFlight.has(note.id)) return { ok: false, reason: "busy" };
  inFlight.add(note.id);

  try {
    const supabase = createClient();

    // Step 1: the audio file (skipped if an earlier try already got it there).
    if (!note.uploadedPath) {
      const type = note.mimeType.split(";")[0] || "audio/webm";
      const path = `${note.businessId}/${note.id}.${extensionFor(type)}`;
      const { error } = await supabase.storage
        .from("audio")
        .upload(path, note.blob, { contentType: type });
      if (error && !/already exists/i.test(error.message)) return failed();
      note.uploadedPath = path;
      await putPending(note).catch(() => {});
    }

    // Step 2: the capture row. 23505 means an earlier try already saved it.
    const { error } = await supabase.from("captures").insert({
      id: note.id,
      business_id: note.businessId,
      user_id: note.userId,
      audio_url: note.uploadedPath,
      status: "recorded",
    });
    if (error && error.code !== "23505") return failed();

    await removePending(note.id).catch(() => {});
    queueChanged();
    return { ok: true };
  } catch {
    return failed();
  } finally {
    inFlight.delete(note.id);
  }
}

// Write a note down and, if there are words, sort them into cards. Quiet: used when nobody is watching.
export async function requestTranscript(captureId: string) {
  try {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captureId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.transcript) await requestSort(captureId);
  } catch {
    /* the Recent notes list offers "Write it down" if this didn't happen */
  }
}

export async function requestSort(captureId: string) {
  await fetch("/api/sort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ captureId }),
  }).catch(() => {});
}

// A waiting note just made it up. If the Talk screen is showing that same note it takes over
// (so it can show the words); otherwise we write it down quietly in the background.
export async function afterSynced(id: string) {
  const event = new CustomEvent(NOTE_SYNCED, {
    detail: { id, handled: false },
  });
  window.dispatchEvent(event);
  if (!event.detail.handled) await requestTranscript(id);
}

// Try every waiting note for this person. Returns how many made it up.
export async function syncAll(userId: string): Promise<number> {
  let done = 0;
  for (const note of await listPending(userId).catch(() => [])) {
    const result = await syncNote(note);
    if (result.ok) {
      done++;
      await afterSynced(note.id);
    } else if (result.reason === "offline") {
      break; // no point trying the rest
    }
  }
  return done;
}
