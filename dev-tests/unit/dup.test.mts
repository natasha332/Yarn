import { findDuplicate, findRepeatedNote, similarity, type Candidate, type ExistingItem } from "../.tmp/lib/duplicates.ts";
const cand = (o: Partial<Candidate>): Candidate => ({ type: "todo", title: "", due_date: null, start_time: null, client_id: null, job_id: null, new_client_name: null, ...o });
const item = (o: Partial<ExistingItem>): ExistingItem => ({ id: "x1", type: "todo", title: "", due_date: null, start_time: null, client_id: null, job_id: null, new_client_name: null, status: "pending", ...o });
const names = new Map([["cl-priya", "Priya Patel"]]);
let bad = 0;
const t = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? "PASS" : "FAIL", "-", name, ok ? "" : `\n   wanted ${JSON.stringify(want)}\n   got    ${JSON.stringify(got)}`); };
const dup = (c: Candidate, items: ExistingItem[], jobs: any[] = []) => !!findDuplicate(c, items, jobs, names);

t("same words in a different order", similarity("Order hinges", "hinges order") >= 0.9, true);
t("'consult' matches 'consultation'", similarity("Consult at Priya's", "Consultation Priya") >= 0.6, true);
t("different tasks are not alike", similarity("Order hinges", "Call the plumber") < 0.3, true);

console.log("--- calendar");
const cal = (o: Partial<Candidate>) => cand({ type: "calendar", ...o });
const calItem = (o: Partial<ExistingItem>) => item({ type: "calendar", ...o });
t("same day, time and wording = duplicate", dup(cal({ title: "Consult at Priya's", due_date: "2026-11-03", start_time: "09:00" }), [calItem({ title: "Consultation Priya", due_date: "2026-11-03", start_time: "09:00:00", status: "confirmed" })]), true);
t("same day and time, same client, different wording = duplicate", dup(cal({ title: "Site visit", due_date: "2026-11-03", start_time: "09:00", client_id: "cl-priya" }), [calItem({ title: "Measure up", due_date: "2026-11-03", start_time: "09:00", client_id: "cl-priya" })]), true);
t("same day and time but a different client and job = NOT a duplicate", dup(cal({ title: "Delivery", due_date: "2026-11-03", start_time: "09:00", client_id: "cl-a" }), [calItem({ title: "Quote visit", due_date: "2026-11-03", start_time: "09:00", client_id: "cl-b" })]), false);
t("same wording, different time = NOT a duplicate", dup(cal({ title: "Consult at Priya's", due_date: "2026-11-03", start_time: "14:00" }), [calItem({ title: "Consult at Priya's", due_date: "2026-11-03", start_time: "09:00" })]), false);
t("same wording, different day = NOT a duplicate", dup(cal({ title: "Consult at Priya's", due_date: "2026-11-04", start_time: "09:00" }), [calItem({ title: "Consult at Priya's", due_date: "2026-11-03", start_time: "09:00" })]), false);

console.log("--- to-do / follow-up");
t("same task, same day = duplicate", dup(cand({ title: "Order soft-close hinges", due_date: "2026-10-30" }), [item({ title: "Order hinges", due_date: "2026-10-30" })]), true);
t("same task, one has no date = duplicate", dup(cand({ title: "Order soft-close hinges", due_date: "2026-10-30" }), [item({ title: "Order soft-close hinges" })]), true);
t("same task, different days = NOT a duplicate", dup(cand({ title: "Order hinges", due_date: "2026-10-30" }), [item({ title: "Order hinges", due_date: "2026-11-05" })]), false);
t("different tasks = NOT a duplicate", dup(cand({ title: "Call the plumber" }), [item({ title: "Order hinges" })]), false);
t("a to-do is not a duplicate of a follow-up", dup(cand({ title: "Chase laundry quote" }), [item({ type: "followup", title: "Chase laundry quote" })]), false);

console.log("--- new job");
const job = (o: Partial<Candidate>) => cand({ type: "job", ...o });
t("same new client and similar job pending = duplicate", dup(job({ title: "Consultation", new_client_name: "Priya" }), [item({ type: "job", title: "Consultation", new_client_name: "priya" })]), true);
t("same client already has that open job = duplicate", dup(job({ title: "Kitchen renovation", client_id: "cl-priya" }), [], [{ id: "j1", name: "Kitchen reno", client_id: "cl-priya", status: "booked" }]), true);
t("new client name matches an existing client's job = duplicate", dup(job({ title: "Laundry", new_client_name: "Priya Patel" }), [], [{ id: "j1", name: "Laundry quote", client_id: "cl-priya", status: "quoted" }]), true);
t("same client, different job = NOT a duplicate", dup(job({ title: "Deck", client_id: "cl-priya" }), [], [{ id: "j1", name: "Kitchen renovation", client_id: "cl-priya", status: "booked" }]), false);
t("different client, same job name = NOT a duplicate", dup(job({ title: "Kitchen renovation", client_id: "cl-other" }), [], [{ id: "j1", name: "Kitchen renovation", client_id: "cl-priya", status: "booked" }]), false);

console.log("--- the label tells you what it matched");
t("label for a confirmed booking", findDuplicate(cal({ title: "Consult", due_date: "2026-11-03", start_time: "09:00" }), [calItem({ id: "c1", title: "Consult at Priya's", due_date: "2026-11-03", start_time: "09:00:00", status: "confirmed" })], [], names)?.label, "“Consult at Priya's” (confirmed · Tue 3 Nov · 9:00am)");

console.log("--- whole note repeated");
const notes = [{ id: "n1", transcript: "Consult at Priya's house on the third of November at nine." }, { id: "n2", transcript: "Order the hinges tomorrow and chase Dave about the laundry quote." }];
t("same words again = repeat", findRepeatedNote("Consult at Priya's house on the third of November at nine.", notes)?.id, "n1");
t("slightly different wording = still a repeat", findRepeatedNote("Consult at Priyas house third of November at nine", notes)?.id, "n1");
t("a different note is not a repeat", findRepeatedNote("Pick up the benchtop from the stone yard on Friday morning.", notes), null);
t("very short notes are never called repeats", findRepeatedNote("Test", [{ id: "n9", transcript: "Test" }]), null);
process.exit(bad ? 1 : 0);
