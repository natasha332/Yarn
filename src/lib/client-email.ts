import { formatClock, formatDay } from "@/lib/format";

// The emails Yarn writes to clients on the tradie's behalf. The facts (which booking, which old and
// new time) are filled in by code, never by the AI, so they can't be wrong. The tradie reads and
// sends every one themselves.

export type EmailKind = "reschedule" | "cancel" | "other";
export type EmailDraft = { to: string | null; subject: string; body: string; kind: EmailKind };

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

// "Tabrez\nSunday Kitchens" unless they've set their own sign-off.
export const defaultSignOff = (personName: string | null, businessName: string) =>
  [personName?.trim(), businessName].filter(Boolean).join("\n");

const when = (date: string, start: string | null) =>
  [formatDay(date), start && formatClock(start.slice(0, 5))].filter(Boolean).join(", ");

const greeting = (client: string | null) => (firstName(client) ? `Hi ${firstName(client)},` : "Hi,");

const tidyNote = (note: string | null | undefined) => {
  const n = (note ?? "").trim().replace(/\s+/g, " ").slice(0, 300);
  return n || null;
};

export function composeBookingEmail(args: {
  kind: "reschedule" | "cancel";
  clientName: string | null;
  bookingTitle: string;
  old: { date: string; start: string | null };
  next?: { date: string; start: string | null };
  note?: string | null;
  signOff: string;
}): { subject: string; body: string } {
  const note = tidyNote(args.note);
  const oldWhen = when(args.old.date, args.old.start);

  if (args.kind === "reschedule" && args.next) {
    const newWhen = when(args.next.date, args.next.start);
    return {
      subject: `Moving our booking to ${newWhen}`,
      body: [
        greeting(args.clientName),
        `I need to move our booking (${args.bookingTitle}) from ${oldWhen} to ${newWhen}.${note ? ` ${note}` : ""}`,
        "Let me know if that doesn't suit and we'll find another time.",
        `Thanks,\n${args.signOff}`,
      ].join("\n\n"),
    };
  }
  return {
    subject: `Cancelling our booking on ${formatDay(args.old.date)}`,
    body: [
      greeting(args.clientName),
      `I need to cancel our booking (${args.bookingTitle}) on ${oldWhen}.${note ? ` ${note}` : ""}`,
      "Sorry for the inconvenience.",
      `Thanks,\n${args.signOff}`,
    ].join("\n\n"),
  };
}

// A free-form message she dictated: the AI supplies the middle, we add the greeting and sign-off.
export function composeOtherEmail(args: {
  clientName: string | null;
  subject: string | null;
  message: string;
  businessName: string;
  signOff: string;
}): { subject: string; body: string } {
  return {
    subject: (args.subject ?? "").trim().slice(0, 150) || `A message from ${args.businessName}`,
    body: [greeting(args.clientName), args.message.trim(), `Thanks,\n${args.signOff}`].join("\n\n"),
  };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// What actually goes out: a plain, personal-looking email (not a marketing template).
export function renderClientEmail(body: string) {
  const text = `${body.trim()}\n\n--\nSent with Yarn`;
  const html = `<!doctype html><html><body style="margin:0;padding:16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1b2023">${body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("")}<p style="margin:24px 0 0;font-size:12px;color:#8a9296">Sent with Yarn</p></body></html>`;
  return { html, text };
}

export const isEmail = (s: string | null | undefined) =>
  !!s && s.length <= 254 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(s.trim());
