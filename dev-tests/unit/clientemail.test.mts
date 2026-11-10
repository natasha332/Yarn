import { composeBookingEmail, composeOtherEmail, renderClientEmail, isEmail, firstName, defaultSignOff, buildMailto } from "../.tmp/lib/client-email.ts";
import assert from "node:assert/strict";
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };
const sign = "Tabrez\nSunday Kitchens";
ok("reschedule: exact old and new times, friendly, signed", () => {
  const e = composeBookingEmail({ kind: "reschedule", clientName: "Robyn Clarke", bookingTitle: "Site visit", old: { date: "2026-11-03", start: "14:00" }, next: { date: "2026-11-12", start: "09:00" }, note: "It's because of a supplier delay.", signOff: sign });
  assert.equal(e.subject, "Moving our booking to Thu 12 Nov, 9:00am");
  assert.ok(e.body.startsWith("Hi Robyn,\n\n"));
  assert.ok(e.body.includes("(Site visit) from Tue 3 Nov, 2:00pm to Thu 12 Nov, 9:00am. It's because of a supplier delay."));
  assert.ok(e.body.endsWith("Thanks,\nTabrez\nSunday Kitchens"));
});
ok("reschedule with no note and an all-day booking", () => {
  const e = composeBookingEmail({ kind: "reschedule", clientName: "Dave", bookingTitle: "Delivery day", old: { date: "2026-11-03", start: null }, next: { date: "2026-11-04", start: null }, signOff: sign });
  assert.equal(e.subject, "Moving our booking to Wed 4 Nov");
  assert.ok(e.body.includes("from Tue 3 Nov to Wed 4 Nov.\n"));
});
ok("cancel", () => {
  const e = composeBookingEmail({ kind: "cancel", clientName: "Robyn Clarke", bookingTitle: "Site visit", old: { date: "2026-11-03", start: "14:00" }, note: "I've come down with the flu.", signOff: sign });
  assert.equal(e.subject, "Cancelling our booking on Tue 3 Nov");
  assert.ok(e.body.includes("cancel our booking (Site visit) on Tue 3 Nov, 2:00pm. I've come down with the flu."));
  assert.ok(e.body.includes("Sorry for the inconvenience."));
});
ok("no client name -> plain 'Hi,'", () => assert.ok(composeBookingEmail({ kind: "cancel", clientName: null, bookingTitle: "x", old: { date: "2026-11-03", start: null }, signOff: sign }).body.startsWith("Hi,\n")));
ok("a note is tidied and capped", () => { const e = composeBookingEmail({ kind: "reschedule", clientName: "A", bookingTitle: "x", old: { date: "2026-11-03", start: null }, next: { date: "2026-11-04", start: null }, note: "  lots   of\n\n space " + "y".repeat(500), signOff: sign }); assert.ok(!e.body.includes("  ")); assert.ok(e.body.length < 800); });
ok("free-form email: greeting, her words, sign-off; subject fallback", () => {
  const e = composeOtherEmail({ clientName: "Robyn Clarke", subject: "Quote ready", message: "Your quote is ready.", businessName: "Sunday Kitchens", signOff: sign });
  assert.equal(e.body, "Hi Robyn,\n\nYour quote is ready.\n\nThanks,\nTabrez\nSunday Kitchens");
  assert.equal(composeOtherEmail({ clientName: null, subject: "  ", message: "x", businessName: "Sunday Kitchens", signOff: sign }).subject, "A message from Sunday Kitchens");
});
ok("sent email is escaped, keeps line breaks, has the Yarn footer", () => {
  const r = renderClientEmail("Hi <b>Rob</b>,\n\nSee you & co.\n\nThanks,\nTabrez\nSunday Kitchens");
  assert.ok(!r.html.includes("<b>Rob") && r.html.includes("&lt;b&gt;Rob") && r.html.includes("&amp; co.") && r.html.includes("Tabrez<br>Sunday Kitchens"));
  assert.ok(r.html.includes("Sent with Yarn") && r.text.endsWith("--\nSent with Yarn") && r.text.startsWith("Hi <b>Rob</b>,"));
});
ok("email address check", () => { for (const g of ["a@b.co", "robyn.c+x@example.com.au"]) assert.ok(isEmail(g), g); for (const b of ["", null, "nope", "a@b", "a b@c.com", "a@b.c", "x@y.com, z@w.com", "<a@b.com>", "a@b.com;c@d.com"]) assert.ok(!isEmail(b as string), String(b)); });
ok("names and default sign-off", () => { assert.equal(firstName("Robyn Clarke"), "Robyn"); assert.equal(firstName(null), ""); assert.equal(defaultSignOff("Tabrez", "Sunday Kitchens"), "Tabrez\nSunday Kitchens"); assert.equal(defaultSignOff(null, "Sunday Kitchens"), "Sunday Kitchens"); });
ok("mail-app link: address, subject and message are encoded; line breaks survive", () => {
  const u = buildMailto({ to: "robyn@example.com", subject: "Quote & price?", body: "Hi Robyn,\n\nYour quote is ready.\n\nThanks,\nTabrez" })!;
  assert.ok(u.startsWith("mailto:robyn@example.com?subject=Quote%20%26%20price%3F&body="));
  const body = decodeURIComponent(u.split("&body=")[1]);
  assert.equal(body, "Hi Robyn,\r\n\r\nYour quote is ready.\r\n\r\nThanks,\r\nTabrez");
});
ok("mail-app link: no usable address -> opens with an empty To so she can pick one", () => {
  assert.ok(buildMailto({ to: null, subject: "x", body: "y" })!.startsWith("mailto:?subject=x&body=y"));
  assert.ok(buildMailto({ to: "not an email", subject: "x", body: "y" })!.startsWith("mailto:?subject="));
});
ok("mail-app link: a message too long for a phone link gets no link (Send is used instead)", () => {
  assert.equal(buildMailto({ to: "a@b.co", subject: "x", body: "word ".repeat(600) }), null);
  assert.ok(buildMailto({ to: "a@b.co", subject: "x", body: "word ".repeat(100) }) !== null);
});
console.log(n, "passed");
