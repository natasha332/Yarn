import { dateIn } from "@/lib/format";
import type { DigestKind } from "@/lib/digest-email";

// Which emails are due for a business right now?
// The timer wakes every 15 minutes. An email is due from its set time until 2 hours later, on the
// same local day: late enough to catch a missed timer, but never a "7am briefing" at 2pm.

export const SEND_WINDOW_MINUTES = 120;

export type BusinessSchedule = {
  timezone: string;
  morning_enabled: boolean;
  morning_email_time: string; // "07:00:00"
  wrapup_mode: string; // 'end_of_day' | 'off'
  wrapup_time: string;
  notify_channel: string; // 'email' | 'push' | 'both'
};

export type DueDigest = { kind: DigestKind; localDate: string };

function localMinutes(timeZone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function dueDigests(b: BusinessSchedule, now: Date): DueDigest[] {
  const nowMin = localMinutes(b.timezone, now);
  const localDate = dateIn(b.timezone, now);
  const due = (time: string) => {
    const at = minutesOf(time);
    return nowMin >= at && nowMin < Math.min(at + SEND_WINDOW_MINUTES, 1440);
  };

  const out: DueDigest[] = [];
  if (b.morning_enabled && due(b.morning_email_time)) out.push({ kind: "morning", localDate });
  if (b.wrapup_mode !== "off" && due(b.wrapup_time)) out.push({ kind: "wrapup", localDate });
  return out;
}
