import { personLabel } from "../.tmp/lib/people.ts";
import assert from "node:assert/strict";
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };
ok("a client is just their name", () => assert.equal(personLabel({ name: "Dave Nguyen", kind: "client", role: null }), "Dave Nguyen"));
ok("no kind (older data) is treated as a client", () => assert.equal(personLabel({ name: "Dave Nguyen" }), "Dave Nguyen"));
ok("a business contact shows their role", () => assert.equal(personLabel({ name: "Sam Lee", kind: "contact", role: "Accountant" }), "Sam Lee · Accountant"));
ok("a business contact with no role still says what they are", () => assert.equal(personLabel({ name: "Sam Lee", kind: "contact", role: "  " }), "Sam Lee · Business contact"));
ok("nobody is nothing", () => { assert.equal(personLabel(null), null); assert.equal(personLabel(undefined), null); });
console.log(`${n} passed`);
