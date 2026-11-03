import { formatClock, formatDay, formatLongDay } from "@/lib/format";
import type { Digest, DigestItem } from "@/lib/digest";

// Turns a Digest into an email (a nice version and a plain-text version).
// Everything that came from a voice note is escaped, so nothing she said can break the page.

export type DigestKind = "morning" | "wrapup";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const time = (i: DigestItem) =>
  i.start ? formatClock(i.start) + (i.end ? ` – ${formatClock(i.end)}` : "") : "All day";

function overdue(i: DigestItem, today: string) {
  return i.date && i.date < today ? `overdue, was ${formatDay(i.date)}` : null;
}

type Section = { title: string; empty: string; rows: { lead?: string; main: string; tag?: string; sub: string[] }[] };

function sections(kind: DigestKind, d: Digest): Section[] {
  const booking = (i: DigestItem) => ({
    lead: time(i),
    main: i.title,
    tag: i.source === "calendar" ? "Calendar" : undefined,
    sub: [i.who, i.address ?? ""].filter(Boolean),
  });
  const todo = (i: DigestItem) => ({
    main: i.title,
    sub: [i.who, overdue(i, d.today) ?? ""].filter(Boolean),
  });

  if (kind === "morning") {
    return [
      { title: "Today's schedule", empty: "Nothing booked for today.", rows: d.schedule.map(booking) },
      { title: "To-dos and follow-ups", empty: "Nothing to do. Nice.", rows: d.todos.map(todo) },
    ];
  }
  return [
    { title: "Done today", empty: "Nothing ticked off today.", rows: d.doneToday.map(todo) },
    { title: "Still open", empty: "Nothing left open. Nice.", rows: d.todos.map(todo) },
    { title: "Tomorrow", empty: "Nothing booked for tomorrow.", rows: d.tomorrow.map(booking) },
  ];
}

export function renderDigest(kind: DigestKind, d: Digest, opts: { businessName: string; siteUrl: string }) {
  const heading = kind === "morning" ? `Today, ${formatLongDay(d.today)}` : `Wrap-up, ${formatLongDay(d.today)}`;
  const subject =
    kind === "morning"
      ? `Today, ${formatDay(d.today)}: ${d.schedule.length ? plural(d.schedule.length, "appointment") : "nothing booked"}, ${plural(d.todos.length, "to-do")}`
      : `Wrap-up, ${formatDay(d.today)}: ${d.doneToday.length} done, ${d.todos.length} still open`;
  const secs = sections(kind, d);
  const waiting = d.waiting
    ? `${plural(d.waiting, "card")} waiting for you to check in Yarn.`
    : null;
  const link = `${opts.siteUrl.replace(/\/$/, "")}/${kind === "morning" ? "today" : ""}`;

  const text = [
    heading,
    opts.businessName,
    "",
    ...secs.flatMap((s) => [
      s.title.toUpperCase(),
      ...(s.rows.length
        ? s.rows.map((r) => `- ${r.lead ? `${r.lead}  ` : ""}${r.main}${r.tag ? ` [${r.tag}]` : ""}${r.sub.length ? ` (${r.sub.join(", ")})` : ""}`)
        : [s.empty]),
      "",
    ]),
    ...(waiting ? [waiting, ""] : []),
    `Open Yarn: ${link}`,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#eef0ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2023">
<div style="max-width:520px;margin:0 auto;padding:20px 16px">
  <p style="margin:0 0 4px;font-size:28px;font-weight:800">yarn<span style="color:#e55a0f">.</span></p>
  <h1 style="margin:8px 0 2px;font-size:24px;line-height:1.2">${esc(heading)}</h1>
  <p style="margin:0 0 20px;color:#5b6468">${esc(opts.businessName)}</p>
  ${secs
    .map(
      (s) => `<h2 style="margin:22px 0 8px;font-size:18px">${esc(s.title)} <span style="color:#5b6468;font-weight:400">${s.rows.length || ""}</span></h2>
  ${
    s.rows.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #d9dedb;border-radius:12px">${s.rows
          .map(
            (r) => `<tr><td style="padding:12px 14px;border-top:1px solid #eef0ee">${
              r.lead ? `<span style="display:inline-block;min-width:92px;color:#5b6468;font-size:13px">${esc(r.lead)}</span>` : ""
            }<b>${esc(r.main)}</b>${
              r.tag ? ` <span style="display:inline-block;margin-left:4px;padding:1px 7px;border-radius:999px;background:#eef0ee;color:#5b6468;font-size:11px;font-weight:700;vertical-align:middle">${esc(r.tag)}</span>` : ""
            }${r.sub.map((x) => `<br><span style="color:#5b6468;font-size:14px">${esc(x)}</span>`).join("")}</td></tr>`,
          )
          .join("")}</table>`
      : `<p style="margin:0;padding:12px 14px;background:#fff;border:1px dashed #d9dedb;border-radius:12px;color:#5b6468">${esc(s.empty)}</p>`
  }`,
    )
    .join("\n")}
  ${waiting ? `<p style="margin:22px 0 0;padding:12px 14px;border:1px solid #e55a0f;border-radius:12px;background:#fff"><b>${esc(waiting)}</b></p>` : ""}
  <p style="margin:24px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#e55a0f;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Open Yarn</a></p>
</div></body></html>`;

  return { subject, html, text };
}
