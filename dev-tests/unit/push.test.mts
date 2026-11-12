import { pushSummary } from "../.tmp/lib/push-summary.ts";
import { parseSubscription } from "../.tmp/lib/push.ts";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };
const item = (title: string, start: string | null = null) => ({ id: title, title, date: "2026-11-03", start, end: null, who: "", address: null });
const base = { today: "2026-11-03", schedule: [], tomorrow: [], todos: [], doneToday: [], waiting: 0 };
ok("morning: names the day's bookings and to-dos", () => {
  const p = pushSummary("morning", { ...base, schedule: [item("Consult at Priya's", "09:00"), item("Site visit", "14:00")], todos: [item("a"), item("b")], waiting: 1 });
  assert.equal(p.title, "Today, Tue 3 Nov");
  assert.equal(p.body, "9:00am Consult at Priya's\n2:00pm Site visit\nTo do: a, b\n1 to check in Yarn");
  assert.equal(p.url, "/today");
});
ok("morning: a quiet day", () => assert.equal(pushSummary("morning", base).body, "Nothing booked"));
ok("morning: an untimed booking and one to-do", () => assert.equal(pushSummary("morning", { ...base, schedule: [item("Delivery")], todos: [item("x")] }).body, "Delivery\nTo do: x"));
ok("morning: long lists are cut with +N more", () => {
  const p = pushSummary("morning", { ...base, schedule: ["a", "b", "c", "d", "e"].map((t, i) => item(t, `0${i + 6}:00`)), todos: ["t1", "t2", "t3", "t4", "t5"].map((t) => item(t)) });
  assert.equal(p.body, "6:00am a\n7:00am b\n8:00am c\n+2 more booked\nTo do: t1, t2, t3 +2 more");
});
ok("wrap-up: what is still open, and tomorrow", () => {
  const p = pushSummary("wrapup", { ...base, doneToday: [item("a")], todos: [item("b"), item("c")], tomorrow: [item("Measure-up", "08:30")] });
  assert.equal(p.title, "Wrap-up, Tue 3 Nov");
  assert.equal(p.body, "Still open: b, c\nTomorrow: 8:30am Measure-up");
});
ok("wrap-up: all clear, nothing tomorrow", () => assert.equal(pushSummary("wrapup", base).body, "Nothing left open. Nice work.\nNothing booked tomorrow"));
ok("a long title is cut so it fits a lock screen", () => assert.ok(pushSummary("morning", { ...base, schedule: [item("x".repeat(300), "09:00")] }).body.length <= 60));
const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
ok("a real browser subscription is accepted", () => assert.deepEqual(parseSubscription(good), { endpoint: good.endpoint, p256dh: good.keys.p256dh, auth: good.keys.auth }));
ok("only real push services are accepted (nobody can point Yarn's server at another address)", () => {
  for (const host of ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "wns2-par02p.notify.windows.com"]) assert.ok(parseSubscription({ ...good, endpoint: `https://${host}/x/abc` }), host);
  for (const host of ["169.254.169.254", "localhost", "internal.example.com", "evil.com", "fcm.googleapis.com.evil.com", "notfcm.googleapis.com", "push.apple.com.evil.com", "127.0.0.1"]) assert.equal(parseSubscription({ ...good, endpoint: `https://${host}/latest/meta-data` }), null, host);
});
ok("anything odd is refused", () => {
  for (const bad of [null, {}, { ...good, endpoint: "http://insecure.example.com/x" }, { ...good, endpoint: "not a url" }, { ...good, endpoint: "https://x.com/" + "a".repeat(1100) },
    { ...good, keys: { ...good.keys, p256dh: "short" } }, { ...good, keys: { p256dh: good.keys.p256dh } }, { ...good, keys: { ...good.keys, auth: "a b" } }, { endpoint: 5, keys: good.keys }])
    assert.equal(parseSubscription(bad), null);
});
console.log(n, "passed");
