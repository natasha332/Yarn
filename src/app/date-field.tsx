"use client";

import { useState } from "react";
import {
  deviceToday,
  monthGrid,
  monthTitle,
  shiftMonth,
} from "@/lib/calendar-grid";
import {
  addDays,
  formatLongDay,
  formatNumericDay,
  todayIn,
} from "@/lib/format";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Yarn's own date picker: tap a day on a month calendar (weeks start on Monday).
// The phone's built-in date box follows the phone's region and shows month-first dates,
// so this one always shows the day first.
export default function DateField({
  label,
  value,
  onChange,
  optional = false,
  startOpen = false,
  timezone,
  className = "",
}: {
  label: string;
  value: string; // "2026-11-05", or "" for no date
  onChange: (iso: string, valid: boolean) => void;
  optional?: boolean; // shows a "No date" button
  startOpen?: boolean; // opens the calendar straight away
  timezone?: string; // the business's timezone, so "Today" means the same day as on every other screen
  className?: string;
}) {
  const today = timezone ? todayIn(timezone) : deviceToday();
  const [open, setOpen] = useState(startOpen || !value);
  const [view, setView] = useState(() => {
    const [y, m] = (value || today).split("-").map(Number);
    return { year: y, month0: m - 1 };
  });

  function pick(iso: string) {
    onChange(iso, true);
    setOpen(false);
    if (iso) {
      const [y, m] = iso.split("-").map(Number);
      setView({ year: y, month0: m - 1 });
    }
  }

  const quick = [
    { text: "Today", iso: today },
    { text: "Tomorrow", iso: addDays(today, 1) },
    { text: "In a week", iso: addDays(today, 7) },
  ];

  return (
    <div
      role="group"
      aria-label={label}
      className={`flex min-w-0 flex-col gap-1 ${className}`}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 text-left text-base font-normal"
      >
        <span className={`truncate ${value ? "" : "text-muted"}`}>
          {value ? formatLongDay(value) : "Choose a day"}
        </span>
        <span className="shrink-0 font-mono text-sm text-muted">
          {value ? formatNumericDay(value) : "▾"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2">
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.text}
                type="button"
                onClick={() => pick(q.iso)}
                className={`h-10 rounded-lg border px-3 text-sm font-semibold ${
                  value === q.iso ? "border-accent text-accent" : "border-line"
                }`}
              >
                {q.text}
              </button>
            ))}
            {optional && (
              <button
                type="button"
                onClick={() => pick("")}
                className={`h-10 rounded-lg border px-3 text-sm font-semibold ${
                  value === ""
                    ? "border-accent text-accent"
                    : "border-line text-muted"
                }`}
              >
                No date
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView((v) => shiftMonth(v.year, v.month0, -1))}
              className="grid h-11 w-11 place-items-center rounded-lg text-xl"
            >
              ‹
            </button>
            <span className="font-semibold">
              {monthTitle(view.year, view.month0)}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView((v) => shiftMonth(v.year, v.month0, 1))}
              className="grid h-11 w-11 place-items-center rounded-lg text-xl"
            >
              ›
            </button>
          </div>

          <div
            className="grid grid-cols-7 text-center text-xs font-semibold text-muted"
            aria-hidden="true"
          >
            {WEEKDAYS.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>

          <div className="flex flex-col gap-0.5">
            {monthGrid(view.year, view.month0).map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map((day) => {
                  const selected = day.iso === value;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      aria-label={
                        formatLongDay(day.iso) + " " + day.iso.slice(0, 4)
                      }
                      aria-pressed={selected}
                      onClick={() => pick(day.iso)}
                      className={`h-11 min-w-0 rounded-lg text-base ${
                        selected
                          ? "bg-accent font-bold text-accent-ink"
                          : day.iso === today
                            ? "border border-accent font-bold"
                            : !day.inMonth
                              ? "text-muted/50"
                              : day.iso < today
                                ? "text-muted"
                                : ""
                      }`}
                    >
                      {day.day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
