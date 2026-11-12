"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

// A short swipe-through of what Yarn does. Nothing is saved: it's only information.

const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

type Slide = {
  title: string;
  lead: string;
  points: string[];
  colour: string; // one of the item-type colours
  svg: ReactNode;
  examples?: string[];
};

const SLIDES: Slide[] = [
  {
    title: "Talk, don't type.",
    lead: "Tap the big mic and say what happened, the way you'd tell a mate.",
    points: [
      "Works in the ute with no signal: it saves your note and sends it when you're back online.",
      "Nothing is saved or sent anywhere until you tap Confirm.",
    ],
    colour: "text-accent",
    svg: (
      <svg
        viewBox="0 0 24 24"
        className="h-14 w-14"
        aria-hidden="true"
        {...icon}
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
    examples: [
      "“Consult at Priya's on Tuesday at nine.”",
      "“Remind me to order the bench top for Dave.”",
    ],
  },
  {
    title: "Yarn sorts it for you.",
    lead: "Your words turn into cards: bookings, to-dos, follow-ups and job notes.",
    points: [
      "Read each card, then tap Confirm, Edit or Discard.",
      "If two clients sound alike, Yarn asks you instead of guessing.",
    ],
    colour: "text-todo",
    svg: (
      <svg
        viewBox="0 0 24 24"
        className="h-14 w-14"
        aria-hidden="true"
        {...icon}
      >
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    ),
  },
  {
    title: "Your calendar keeps up.",
    lead: "Confirmed bookings go straight into your Google Calendar with a 30 minute reminder.",
    points: [
      "Moved it? Cancelled it? Say so, or tap the button. The calendar event follows.",
      "Connect Google Calendar once in Settings.",
    ],
    colour: "text-cal",
    svg: (
      <svg
        viewBox="0 0 24 24"
        className="h-14 w-14"
        aria-hidden="true"
        {...icon}
      >
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
    examples: [
      "“Push Priya to Thursday at ten.”",
      "“Cancel the Dave quote visit.”",
    ],
  },
  {
    title: "Today, at a glance.",
    lead: "One screen for your schedule, your to-dos and follow-ups, and your job notes.",
    points: [
      "Your other Google Calendar events show up in the same list, in time order.",
      "Tick things off as you go.",
    ],
    colour: "text-followup",
    svg: (
      <svg
        viewBox="0 0 24 24"
        className="h-14 w-14"
        aria-hidden="true"
        {...icon}
      >
        <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    ),
  },
  {
    title: "Emails, written for you.",
    lead: "Tell Yarn who to email and what to say. It writes it, you read it, you tap Send.",
    points: [
      "Moved or cancelled a booking? Yarn offers a “let her know” email.",
      "Connect Gmail (optional) and “reply to Robyn” is saved as a draft in the same email thread. Yarn never sends from your Gmail.",
    ],
    colour: "text-invoice",
    svg: (
      <svg
        viewBox="0 0 24 24"
        className="h-14 w-14"
        aria-hidden="true"
        {...icon}
      >
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 8 8 6 8-6" />
      </svg>
    ),
    examples: [
      "“Email Robyn that I'll be there at ten, and I'll bring the samples.”",
    ],
  },
  {
    title: "A morning briefing, and a wrap-up.",
    lead: "Every morning Yarn tells you what's on today. After work, it wraps up the day.",
    points: [
      "Choose email, a notification on your phone, or both, in Settings.",
      "On iPhone, add Yarn to your Home Screen first so notifications can arrive.",
    ],
    colour: "text-quote",
    svg: (
      <svg
        viewBox="0 0 24 24"
        className="h-14 w-14"
        aria-hidden="true"
        {...icon}
      >
        <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
];

export default function Tour() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-3xl font-bold leading-none">
          yarn<span className="text-accent">.</span>
        </p>
        {!last && (
          <Link href="/" className="font-semibold text-muted underline">
            Skip
          </Link>
        )}
      </div>

      <section
        aria-live="polite"
        className="flex flex-1 flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
      >
        <div className={slide.colour}>{slide.svg}</div>
        <h1 className="font-display text-4xl font-bold leading-none">
          {slide.title}
        </h1>
        <p className="text-lg">{slide.lead}</p>
        <ul className="flex flex-col gap-2 text-muted">
          {slide.points.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden="true" className={slide.colour}>
                •
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {slide.examples && (
          <div className="mt-auto flex flex-col gap-2 rounded-xl bg-sunk p-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Try saying
            </p>
            {slide.examples.map((e) => (
              <p key={e} className="font-medium">
                {e}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="sticky bottom-0 -mx-6 flex flex-col gap-4 bg-bg px-6 pb-4 pt-2">
        <div
          className="flex justify-center gap-2"
          role="group"
          aria-label={`Step ${i + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((s, n) => (
            <span
              key={s.title}
              aria-hidden="true"
              className={`h-2 rounded-full transition-all ${
                n === i ? "w-6 bg-accent" : "w-2 bg-line"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="h-14 rounded-xl border border-line bg-surface px-5 text-lg font-semibold"
            >
              Back
            </button>
          )}
          {last ? (
            <Link
              href="/"
              className="flex h-14 flex-1 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
            >
              Start talking
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setI(i + 1)}
              className="h-14 flex-1 rounded-xl bg-accent text-lg font-semibold text-accent-ink"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
