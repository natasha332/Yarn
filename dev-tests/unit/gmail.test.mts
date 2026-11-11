import { parseAddress, withRe, plainSubject, searchQuery, newText, buildRaw } from "../.tmp/lib/gmail.ts";
import assert from "node:assert/strict";
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };
ok("addresses are split into name and address", () => {
  assert.deepEqual(parseAddress('"Robyn Clarke" <Robyn.C@Example.com>'), { name: "Robyn Clarke", address: "robyn.c@example.com" });
  assert.deepEqual(parseAddress("robyn@example.com"), { name: "", address: "robyn@example.com" });
  assert.deepEqual(parseAddress(undefined), { name: "", address: "" });
});
ok("Re: is added once", () => { assert.equal(withRe("Kitchen quote"), "Re: Kitchen quote"); assert.equal(withRe("Re: Kitchen quote"), "Re: Kitchen quote"); assert.equal(withRe("RE: x"), "RE: x"); assert.equal(withRe(""), "Re: (no subject)"); });
ok("subjects shown to her have no Re: or Fwd: in front", () => { assert.equal(plainSubject("Re: RE: Kitchen quote"), "Kitchen quote"); assert.equal(plainSubject("Fwd: Hi"), "Hi"); assert.equal(plainSubject(""), "(no subject)"); });
ok("search: a saved address is used when there is one", () => assert.equal(searchQuery({ name: "Robyn Clarke", aliases: ["Robyn"], email: "robyn@example.com" }), "(from:robyn@example.com) newer_than:90d"));
ok("search: with no address, the name and nicknames are used", () => assert.equal(searchQuery({ name: "Robyn Clarke", aliases: ["Robyn", "Rob"], email: null }), '(from:"Robyn Clarke" OR from:"Robyn" OR from:"Rob") newer_than:90d'));
ok("search: a hint narrows it, and odd characters are dropped", () => {
  assert.equal(searchQuery({ name: "Dave Nguyen" }, "quote"), '(from:"Dave Nguyen") newer_than:90d quote');
  assert.equal(searchQuery({ name: "Dave" }, 'bad" OR from:evil@x.com )'), '(from:"Dave") newer_than:90d bad OR from evil');
});
ok("search: a quote mark in a name cannot break out of the search", () => assert.ok(!searchQuery({ name: 'Dave" OR from:"evil' }).includes('"evil"')));
const enc = (s: string) => Buffer.from(s).toString("base64url");
ok("the new words are kept, the quoted conversation underneath is dropped", () => {
  const t = newText({ mimeType: "text/plain", body: { data: enc("Hi Tabrez,\nThursday suits.\n\nOn Mon, 2 Nov 2026 at 9:00, Tabrez wrote:\n> can you do Thursday?\n> thanks") } });
  assert.equal(t, "Hi Tabrez,\nThursday suits.");
  assert.equal(newText({ mimeType: "text/plain", body: { data: enc("Yes please.\n> old\n") } }), "Yes please.");
});
ok("html-only emails are turned into plain text", () => assert.equal(newText({ mimeType: "text/html", body: { data: enc("<div>Hi&nbsp;there<br>See you &amp; co.</div><style>p{x:y}</style>") } }), "Hi there\nSee you & co."));
ok("multipart emails: the plain part is found", () => assert.equal(newText({ mimeType: "multipart/alternative", parts: [{ mimeType: "text/html", body: { data: enc("<b>no</b>") } }, { mimeType: "text/plain", body: { data: enc("plain wins") } }] }), "plain wins"));
ok("a long email is cut to the limit", () => assert.equal(newText({ mimeType: "text/plain", body: { data: enc("a".repeat(5000)) } }, 100).length, 100));
ok("the draft is a proper email: threaded, UTF-8, with the exact words", () => {
  const raw = Buffer.from(buildRaw({ to: "robyn@example.com", subject: "Re: Kitchen quote – café", body: "Hi Robyn,\n\nThursday works ✓\n\nThanks,\nTabrez", inReplyTo: "<m1@mail.gmail.com>", references: "<m0@mail.gmail.com>" }), "base64url").toString("utf8");
  const [head, bodyPart] = raw.split("\r\n\r\n");
  assert.ok(head.includes("To: robyn@example.com") && head.includes("In-Reply-To: <m1@mail.gmail.com>") && head.includes("References: <m0@mail.gmail.com> <m1@mail.gmail.com>"));
  assert.ok(head.includes("MIME-Version: 1.0") && head.includes('charset="UTF-8"') && head.includes("Content-Transfer-Encoding: base64"));
  const subject = head.match(/Subject: (.*)/)![1];
  assert.ok(subject.startsWith("=?UTF-8?B?"));
  assert.equal(Buffer.from(subject.slice(10, -2), "base64").toString("utf8"), "Re: Kitchen quote – café");
  assert.equal(Buffer.from(bodyPart.replace(/\r\n/g, ""), "base64").toString("utf8"), "Hi Robyn,\r\n\r\nThursday works ✓\r\n\r\nThanks,\r\nTabrez");
});
ok("a plain ASCII subject stays readable, and a first email has no thread headers", () => {
  const raw = Buffer.from(buildRaw({ to: "a@b.co", subject: "Hello", body: "x" }), "base64url").toString("utf8");
  assert.ok(raw.includes("Subject: Hello\r\n") && !raw.includes("In-Reply-To"));
});
console.log(n, "passed");
