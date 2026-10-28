"use client";

import { useEffect, useRef, useState } from "react";

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

function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function Recorder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

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

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  const recording = phase === "recording";

  return (
    <div className="flex flex-col items-center gap-5 pt-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={phase === "starting"}
        aria-label={recording ? "Stop recording" : "Start recording"}
        className={`grid h-28 w-28 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_0_0_10px_color-mix(in_srgb,var(--accent)_16%,transparent)] transition-transform active:scale-95 disabled:opacity-60 ${
          recording ? "mic-live" : ""
        }`}
      >
        {recording ? (
          <svg viewBox="0 0 24 24" className="h-11 w-11" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-11 w-11"
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
        <p className="text-muted">Tap to talk.</p>
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
            Play it back to check it sounds right. It isn&apos;t saved anywhere yet.
          </p>
        </div>
      )}
    </div>
  );
}
