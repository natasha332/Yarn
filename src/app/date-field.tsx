"use client";

import { useId, useState } from "react";
import { formatTyping, parseDate, toDisplay } from "@/lib/date-input";
import { formatLongDay } from "@/lib/format";

// A date box that works the Australian way: type 05112026 and it becomes 05/11/2026.
// It reads back the day it understood ("Thursday 5 November") so a slip is easy to spot.
export default function DateField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string; // "2026-11-05", or "" for no date
  onChange: (iso: string, valid: boolean) => void; // valid is false for half-typed or impossible dates
  className?: string;
}) {
  const [text, setText] = useState(value ? toDisplay(value) : "");
  const helpId = useId();
  const iso = parseDate(text);
  const finished = text.length === 10;

  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={text}
        aria-describedby={helpId}
        aria-invalid={text !== "" && !iso}
        onChange={(e) => {
          const next = formatTyping(e.target.value);
          setText(next);
          const parsed = parseDate(next);
          onChange(parsed ?? "", next === "" || parsed !== null);
        }}
        className="h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base font-normal"
      />
      <span
        id={helpId}
        className={`text-sm font-normal ${finished && !iso ? "font-semibold text-variation" : "text-muted"}`}
      >
        {iso
          ? formatLongDay(iso)
          : finished
            ? "That isn't a real date"
            : "Day, month, year (like 05/11/2026)"}
      </span>
    </label>
  );
}
