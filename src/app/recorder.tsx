"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
type SaveState = "idle" | "saving" | "saved" | "failed";

function extensionFor(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // What we need to remember so "Try again" never saves the same note twice.
  const blobRef = useRef<Blob | null>(null);
  const captureIdRef = useRef<string | null>(null);
  const uploadedPathRef = useRef<string | null>(null);

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
    blobRef.current = null;
    captureIdRef.current = null;
    uploadedPathRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Try Safari on iPhone or Chrome on Android.");
      return;
    }

    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
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
        blobRef.current = blob;
        void save();
      };

      recorder.start();
      const startedAt = Date.now();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) stop();
      }, 500);
    } catch (err) {
      releaseMic();
      setPhase("idle");
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      setError(
        denied
          ? "Yarn needs the microphone. Allow it in your browser settings, then tap the button again."
          : "Couldn't start the microphone. Check nothing else is using it and try again.",
      );
    }
  }

  // Upload the audio to private storage, then record it in the captures table.
  async function save() {
    const blob = blobRef.current;
    if (!blob) return;
    setSaveState("saving");
    setSaveError(null);

    const supabase = createClient();
    const id = (captureIdRef.current ??= crypto.randomUUID());
    const type = blob.type.split(";")[0] || "audio/webm";

    // Step 1: the audio file (skipped on a retry if it already went up).
    if (!uploadedPathRef.current) {
      const path = `${businessId}/${id}.${extensionFor(type)}`;
      const { error } = await supabase.storage
        .from("audio")
        .upload(path, blob, { contentType: type });
      if (error) {
        setSaveState("failed");
        setSaveError("Couldn't upload the recording. Check your signal and try again.");
        return;
      }
      uploadedPathRef.current = path;
    }

    // Step 2: the capture row that points at it.
    const { error } = await supabase.from("captures").insert({
      id,
      business_id: businessId,
      user_id: userId,
      audio_url: uploadedPathRef.current,
      status: "recorded",
    });
    // 23505 means a previous try already saved it and only the reply got lost.
    if (error && error.code !== "23505") {
      setSaveState("failed");
      setSaveError("The recording uploaded but couldn't be saved. Try again.");
      return;
    }
    setSaveState("saved");
  }

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
        disabled={phase === "starting" || saveState === "saving"}
        aria-label={recording ? "Stop recording" : "Start recording"}
        className={`grid h-[min(68vw,18rem)] w-[min(68vw,18rem)] place-items-center rounded-full bg-accent text-accent-ink shadow-[0_0_0_16px_color-mix(in_srgb,var(--accent)_16%,transparent)] transition-transform active:scale-95 disabled:opacity-60 ${
          recording ? "mic-live" : ""
        }`}
      >
        {recording ? (
          <svg viewBox="0 0 24 24" className="h-[38%] w-[38%]" fill="currentColor" aria-hidden="true">
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
              <i key={i} className="wave-bar" style={{ animationDelay: `${(i % 5) * 0.12}s` }} />
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
          {saveState === "failed" && (
            <>
              <p role="alert" className="text-variation">
                {saveError}
              </p>
              <button
                type="button"
                onClick={() => void save()}
                className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
