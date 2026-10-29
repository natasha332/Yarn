"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NOTE_SYNCED,
  putPending,
  queueChanged,
  type PendingNote,
} from "@/lib/offline-queue";
import { CARDS_HANDLED } from "@/lib/card-events";
import { syncNote } from "@/lib/sync";

// Longest single note. Keeps the file well under the 25 MB transcription limit.
const MAX_SECONDS = 5 * 60;

// Different phones record in different formats: pick the first one this phone supports.
const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

type Phase = "idle" | "starting" | "recording" | "recorded";
type SaveState = "idle" | "saving" | "saved" | "waiting";
type TranscribeState = "idle" | "working" | "done" | "failed";
type SortState = "idle" | "working" | "done" | "failed";

const nowMs = () => Date.now();

function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function Recorder({
  businessId,
  userId,
}: {
  businessId: string;
  userId: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [transcribeState, setTranscribeState] =
    useState<TranscribeState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [sortState, setSortState] = useState<SortState>("idle");
  const [cards, setCards] = useState<
    { id: string; details?: { duplicate_of?: unknown } | null }[]
  >([]);
  const [foundCount, setFoundCount] = useState(0); // how many cards this note made
  const repeats = cards.filter((c) => c.details?.duplicate_of).length;
  const [sortError, setSortError] = useState<string | null>(null);

  // The note being saved. It's kept on the phone first, so "Try again" never saves it twice.
  const noteRef = useRef<PendingNote | null>(null);
  // The cards from the note on screen that still need checking.
  const waitingCardsRef = useRef<Set<string>>(new Set());

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function releaseMic() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Tidy up if the person leaves the screen mid-recording.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      releaseMic();
    };
  }, []);

  // Free the memory used by the previous recording.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function start() {
    setError(null);
    setAudioUrl(null);
    setSaveState("idle");
    setSaveError(null);
    setTranscribeState("idle");
    setTranscript(null);
    setTranscribeError(null);
    setSortState("idle");
    setCards([]);
    setFoundCount(0);
    waitingCardsRef.current = new Set();
    setSortError(null);
    noteRef.current = null;

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "This browser can't record audio. Try Safari on iPhone or Chrome on Android.",
      );
      return;
    }

    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        releaseMic();
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("recorded");
        noteRef.current = {
          id: crypto.randomUUID(),
          businessId,
          userId,
          blob,
          mimeType: blob.type,
          createdAt: new Date().toISOString(),
        };
        void save(true);
      };

      recorder.start();
      const startedAt = nowMs();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((nowMs() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) stop();
      }, 500);
    } catch (err) {
      releaseMic();
      setPhase("idle");
      const denied =
        err instanceof DOMException && err.name === "NotAllowedError";
      setError(
        denied
          ? "Yarn needs the microphone. Allow it in your browser settings, then tap the button again."
          : "Couldn't start the microphone. Check nothing else is using it and try again.",
      );
    }
  }

  // Keep the note on the phone first, then try to send it up. With no signal it simply waits
  // on the phone, and Yarn uploads it by itself when the signal is back.
  async function save(first = false) {
    const note = noteRef.current;
    if (!note) return;
    setSaveState("saving");
    setSaveError(null);

    if (first) await putPending(note).catch(() => {}); // best effort: some browsers block this

    const result = await syncNote(note);
    if (result.ok) {
      setSaveState("saved");
      void transcribe();
    } else if (result.reason !== "busy") {
      setSaveState("waiting");
      setSaveError(
        result.reason === "offline"
          ? "No signal right now. Your note is safe on your phone and will upload by itself when you're back online."
          : "Couldn't upload it just now. Your note is safe on your phone and Yarn will keep trying.",
      );
      queueChanged();
    }
  }

  // Ask the server to sort the words into cards for you to check.
  const sortIntoCards = useCallback(async () => {
    const id = noteRef.current?.id;
    if (!id) return;
    setSortState("working");
    setSortError(null);
    try {
      const res = await fetch("/api/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captureId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      const found: { id: string }[] = data.cards ?? [];
      waitingCardsRef.current = new Set(found.map((c) => c.id));
      setCards(data.cards ?? []);
      setFoundCount(found.length);
      setSortState("done");
    } catch (err) {
      setSortError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Couldn't reach Yarn. Check your signal and try again.",
      );
      setSortState("failed");
    }
    router.refresh();
  }, [router]);

  // Everything under the mic about the note you just recorded: back to a clean "Tap to talk".
  const clearResults = useCallback(() => {
    setPhase("idle");
    setSeconds(0);
    setError(null);
    setAudioUrl(null);
    setSaveState("idle");
    setSaveError(null);
    setTranscribeState("idle");
    setTranscript(null);
    setTranscribeError(null);
    setSortState("idle");
    setCards([]);
    setFoundCount(0);
    setSortError(null);
    waitingCardsRef.current = new Set();
    noteRef.current = null;
  }, []);

  // Cards were confirmed or discarded below: keep the message honest, and once the last one
  // from this note is dealt with, tidy up the Talk screen too.
  useEffect(() => {
    function onHandled(e: Event) {
      const { ids } = (e as CustomEvent<{ ids: string[] }>).detail;
      const waiting = waitingCardsRef.current;
      if (!ids.some((id) => waiting.has(id))) return; // not about the note on screen
      ids.forEach((id) => waiting.delete(id));
      setCards((current) => current.filter((c) => waiting.has(c.id)));
      if (waiting.size === 0) clearResults();
    }
    window.addEventListener(CARDS_HANDLED, onHandled);
    return () => window.removeEventListener(CARDS_HANDLED, onHandled);
  }, [clearResults]);

  // Ask the server to turn the saved recording into words.
  const transcribe = useCallback(async () => {
    const id = noteRef.current?.id;
    if (!id) return;
    setTranscribeState("working");
    setTranscribeError(null);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captureId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setTranscript(data.transcript ?? "");
      setTranscribeState("done");
      router.refresh(); // so the new note shows in the Recent notes list
      if (data.transcript) void sortIntoCards();
    } catch (err) {
      setTranscribeError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Couldn't reach Yarn. Check your signal and try again.",
      );
      setTranscribeState("failed");
      router.refresh();
    }
  }, [router, sortIntoCards]);

  // The note on screen was waiting on the phone and has just gone up: carry on from here.
  useEffect(() => {
    function onSynced(e: Event) {
      const detail = (e as CustomEvent<{ id: string; handled: boolean }>)
        .detail;
      if (detail.id !== noteRef.current?.id) return;
      detail.handled = true;
      setSaveState("saved");
      void transcribe();
    }
    window.addEventListener(NOTE_SYNCED, onSynced);
    return () => window.removeEventListener(NOTE_SYNCED, onSynced);
  }, [transcribe]);

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  const recording = phase === "recording";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={
          phase === "starting" ||
          saveState === "saving" ||
          transcribeState === "working"
        }
        aria-label={recording ? "Stop recording" : "Start recording"}
        className={`grid h-[min(68vw,18rem)] w-[min(68vw,18rem)] place-items-center rounded-full bg-accent text-accent-ink shadow-[0_0_0_16px_color-mix(in_srgb,var(--accent)_16%,transparent)] transition-transform active:scale-95 disabled:opacity-60 ${
          recording ? "mic-live" : ""
        }`}
      >
        {recording ? (
          <svg
            viewBox="0 0 24 24"
            className="h-[38%] w-[38%]"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-[38%] w-[38%]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        )}
      </button>

      {recording ? (
        <>
          <div className="flex h-7 items-center gap-1" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <i
                key={i}
                className="wave-bar"
                style={{ animationDelay: `${(i % 5) * 0.12}s` }}
              />
            ))}
          </div>
          <p className="font-mono text-lg" role="timer">
            {formatTime(seconds)}
          </p>
          <p className="text-muted">Tap the button when you&apos;re done.</p>
        </>
      ) : phase === "starting" ? (
        <p className="text-muted">Starting the microphone…</p>
      ) : phase === "recorded" ? (
        <p className="text-muted">Got it. Tap to talk again.</p>
      ) : (
        <p className="font-display text-3xl font-bold">Tap to talk</p>
      )}

      {error && (
        <p role="alert" className="text-center text-variation">
          {error}
        </p>
      )}

      {phase === "recorded" && audioUrl && (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            What you recorded ({formatTime(seconds)})
          </span>
          <audio controls src={audioUrl} className="w-full" />
          <p className="text-sm text-muted">
            Play it back to check it sounds right.
          </p>
          {saveState === "saving" && <p className="text-muted">Saving…</p>}
          {saveState === "saved" && <p className="text-invoice">Saved.</p>}
          {saveState === "waiting" && (
            <p role="status" className="font-semibold">
              {saveError}
            </p>
          )}
        </div>
      )}

      {saveState === "saved" && transcribeState === "working" && (
        <p className="text-muted">Writing it down…</p>
      )}

      {transcribeState === "done" && (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            What you said
          </span>
          {transcript ? (
            <p className="italic">{transcript}</p>
          ) : (
            <p className="text-muted">
              I didn&apos;t catch anything. Try again a bit closer to the phone.
            </p>
          )}
        </div>
      )}

      {sortState === "working" && (
        <p className="text-muted">Sorting it into cards…</p>
      )}

      {sortState === "done" && cards.length === 0 && (
        <p className="text-muted">Nothing to sort in this one.</p>
      )}

      {sortState === "done" && cards.length > 0 && (
        <p className="text-center font-semibold">
          {repeats === cards.length
            ? "This looks like a repeat of something already in Yarn. Check below."
            : cards.length < foundCount
              ? `${cards.length} left to check below.`
              : `Found ${cards.length} ${cards.length === 1 ? "thing" : "things"}. Check ${cards.length === 1 ? "it" : "them"} below.`}
        </p>
      )}

      {sortState === "failed" && (
        <div className="flex w-full flex-col gap-2">
          <p role="alert" className="text-center text-variation">
            {sortError}
          </p>
          <button
            type="button"
            onClick={() => void sortIntoCards()}
            className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink"
          >
            Try again
          </button>
        </div>
      )}

      {transcribeState === "failed" && (
        <div className="flex w-full flex-col gap-2">
          <p role="alert" className="text-center text-variation">
            {transcribeError}
          </p>
          <button
            type="button"
            onClick={() => void transcribe()}
            className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
