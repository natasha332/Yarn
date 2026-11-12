import { formatClock, formatDay } from "@/lib/format";
import type { Digest, DigestItem } from "@/lib/digest";
import type { DigestKind } from "@/lib/digest-email";
import type { PushPayload } from "@/lib/push";

// The short version of the briefing or wrap-up, for a lock screen.
// It names what is actually left, a few lines at most, rather than counting it.

const MAX_LINES = 3; // how many items to name per list before "+N more"
const label = (i: DigestItem) =>
  `${i.start ? `${formatClock(i.start)} ` : ""}${i.title}`;
const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

// "a, b, c +2 more"
function names(
  items: DigestItem[],
  text: (i: DigestItem) => string = (i) => i.title,
) {
  const shown = items.slice(0, MAX_LINES).map((i) => clip(text(i), 40));
  const more = items.length - shown.length;
  return shown.join(", ") + (more > 0 ? ` +${more} more` : "");
}

export function pushSummary(kind: DigestKind, d: Digest): PushPayload {
  const lines: string[] = [];
  if (kind === "morning") {
    // Timed items first, one per line, so the day reads top to bottom.
    for (const i of d.schedule.slice(0, MAX_LINES))
      lines.push(clip(label(i), 60));
    if (d.schedule.length > MAX_LINES)
      lines.push(`+${d.schedule.length - MAX_LINES} more booked`);
    if (!d.schedule.length) lines.push("Nothing booked");
    if (d.todos.length) lines.push(`To do: ${names(d.todos)}`);
    if (d.waiting) lines.push(`${d.waiting} to check in Yarn`);
    return {
      title: `Today, ${formatDay(d.today)}`,
      body: lines.join("\n"),
      url: "/today",
      tag: "yarn-briefing",
    };
  }
  lines.push(
    d.todos.length
      ? `Still open: ${names(d.todos)}`
      : "Nothing left open. Nice work.",
  );
  const next = d.tomorrow[0];
  lines.push(
    next ? `Tomorrow: ${clip(label(next), 60)}` : "Nothing booked tomorrow",
  );
  if (d.waiting) lines.push(`${d.waiting} to check in Yarn`);
  return {
    title: `Wrap-up, ${formatDay(d.today)}`,
    body: lines.join("\n"),
    url: "/today",
    tag: "yarn-wrapup",
  };
}
