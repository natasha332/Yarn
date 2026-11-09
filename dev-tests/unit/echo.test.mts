import { removePromptEcho } from "../.tmp/lib/transcript.ts";
const cases: [string, string, string][] = [
  ["Natasha's real example", "context: ### An Australian tradie talking about jobs, clients, bookings, quotes and invoices. Names that may come up: Robyn Clarke, Robyn, Rob, Dave Nguyen.", ""],
  ["intro sentence only", "An Australian tradie talking about jobs, clients, bookings, quotes and invoices.", ""],
  ["normal speech untouched", "Consult at Robyn's house on the third of November at nine.", "Consult at Robyn's house on the third of November at nine."],
  ["real note then echo", "Order hinges tomorrow for the Smith kitchen. An Australian tradie talking about jobs, clients, bookings, quotes and invoices.", "Order hinges tomorrow for the Smith kitchen."],
  ["word 'context' in real speech", "Check the context: the Smith job moved to Friday.", "Check the context: the Smith job moved to Friday."],
  ["empty", "", ""],
];
let bad = 0;
for (const [name, input, want] of cases) {
  const got = removePromptEcho(input);
  const ok = got === want; if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", "-", name, ok ? "" : `\n   wanted: "${want}"\n   got:    "${got}"`);
}
process.exit(bad ? 1 : 0);
