import { formatClock, formatDay } from "@/lib/format";
import type { Digest, DigestItem } from "@/lib/digest";
import type { DigestKind } from "@/lib/digest-email";
import type { PushPayload } from "@/lib/push";

// The short version of the briefing or wrap-up, for a lock screen.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const label = (i: DigestItem) => `${i.start ? `${formatClock(i.start)} ` : ""}${i.title}`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function pushSummary(kind: DigestKind, d: Digest): PushPayload {
  if (kind === "morning") {
    const parts = [
      d.schedule.length ? plural(d.schedule.length, "appointment") : "Nothing booked",
      plural(d.todos.length, "to-do"),
    ];
    if (d.waiting) parts.push(`${plural(d.waiting, "card")} to check`);
    const first = d.schedule[0];
    return {
      title: `Today, ${formatDay(d.today)}`,
      body: clip(`${parts.join(" · ")}${first ? `. First up: ${label(first)}` : ""}`, 140),
      url: "/today",
      tag: "yarn-briefing",
    };
  }
  const next = d.tomorrow[0];
  const parts = [`${d.doneToday.length} done`, `${d.todos.length} still open`];
  if (d.waiting) parts.push(`${plural(d.waiting, "card")} to check`);
  return {
    title: `Wrap-up, ${formatDay(d.today)}`,
    body: clip(`${parts.join(" · ")}. ${next ? `Tomorrow: ${label(next)}` : "Nothing booked tomorrow"}`, 140),
    url: "/today",
    tag: "yarn-wrapup",
  };
}
