import { resolveChange, type Booking, type ChangeInput } from "../.tmp/lib/bookings.ts";
let bad = 0;
const t = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? "PASS" : "FAIL", "-", name, ok ? "" : `\n   wanted ${JSON.stringify(want)}\n   got    ${JSON.stringify(got)}`); };
const B: Booking[] = [
  { id: "b1", title: "Consult at Priya's", date: "2026-11-03", start: "09:00", end: "10:00", client: "Priya" },
  { id: "b2", title: "Site visit", date: "2026-11-04", start: "14:00", end: null, client: "Dave Nguyen" },
  { id: "b3", title: "Delivery day", date: "2026-11-05", start: null, end: null, client: null },
];
const re = (o: Partial<ChangeInput>): ChangeInput => ({ type: "reschedule", title: "", target_booking_id: null, target_options: [], date: null, start_time: null, end_time: null, ...o });
const ca = (o: Partial<ChangeInput>): ChangeInput => ({ ...re({}), type: "cancel", ...o });

console.log("--- finding the booking");
t("a named booking is the target", resolveChange(re({ target_booking_id: "b1", date: "2026-11-05", start_time: "14:00" }), B).targetId, "b1");
t("an invented id is thrown away (and the nearest bookings are offered)", (() => { const r = resolveChange(ca({ target_booking_id: "bogus" }), B); return [r.targetId, r.options.length]; })(), [null, 3]);
t("two possible bookings: no target, both offered", (() => { const r = resolveChange(ca({ target_options: ["b1", "b2"] }), B); return [r.targetId, r.options.map(o => o.id)]; })(), [null, ["b1", "b2"]]);
t("a single option counts as the answer", (() => { const r = resolveChange(ca({ target_options: ["b2"] }), B); return [r.targetId, r.options.length]; })(), ["b2", 0]);
t("invented ids inside the options are dropped", resolveChange(ca({ target_options: ["b1", "nope", "b2"] }), B).options.map(o => o.id), ["b1", "b2"]);
t("duplicate options are listed once", resolveChange(ca({ target_options: ["b1", "b1", "b2"] }), B).options.map(o => o.id), ["b1", "b2"]);
t("nothing matched: the nearest bookings (up to 6) are offered so you're never stuck", resolveChange(ca({}), [...B, ...B.map(b => ({ ...b, id: b.id + "x" })), ...B.map(b => ({ ...b, id: b.id + "y" }))]).options.length, 6);
t("no bookings at all: nothing to offer, nothing to crash", (() => { const r = resolveChange(ca({}), []); return [r.targetId, r.options.length, r.title]; })(), [null, 0, "Cancel a booking"]);

console.log("--- the new time");
t("only a new day: the time stays as it was", (() => { const r = resolveChange(re({ target_booking_id: "b1", date: "2026-11-05" }), B); return [r.due_date, r.start_time, r.end_time]; })(), ["2026-11-05", "09:00", "10:00"]);
t("a new day and time: those are used", (() => { const r = resolveChange(re({ target_booking_id: "b1", date: "2026-11-05", start_time: "14:00", end_time: "15:30" }), B); return [r.due_date, r.start_time, r.end_time]; })(), ["2026-11-05", "14:00", "15:30"]);
t("only a new time: the day stays", (() => { const r = resolveChange(re({ target_booking_id: "b1", start_time: "16:00" }), B); return [r.due_date, r.start_time]; })(), ["2026-11-03", "16:00"]);
t("an all-day booking moved to a day stays all-day", (() => { const r = resolveChange(re({ target_booking_id: "b3", date: "2026-11-09" }), B); return [r.due_date, r.start_time, r.end_time]; })(), ["2026-11-09", null, null]);
t("a cancel carries no new date or time", (() => { const r = resolveChange(ca({ target_booking_id: "b1", date: "2026-11-09", start_time: "10:00" }), B); return [r.due_date, r.start_time, r.end_time]; })(), [null, null, null]);

console.log("--- already there?");
t("moving to exactly where it already is is spotted", resolveChange(re({ target_booking_id: "b1", date: "2026-11-03", start_time: "09:00" }), B).alreadyThere, true);
t("same day, different time is a real move", resolveChange(re({ target_booking_id: "b1", date: "2026-11-03", start_time: "11:00" }), B).alreadyThere, false);
t("no new details at all counts as already there", resolveChange(re({ target_booking_id: "b1" }), B).alreadyThere, true);
t("a cancel is never 'already there'", resolveChange(ca({ target_booking_id: "b1" }), B).alreadyThere, false);

console.log("--- the card title");
t("uses the sorter's wording when it gave one", resolveChange(re({ title: "Move Priya to Thursday", target_booking_id: "b1" }), B).title, "Move Priya to Thursday");
t("otherwise builds it from the booking", [resolveChange(re({ target_booking_id: "b2" }), B).title, resolveChange(ca({ target_booking_id: "b2" }), B).title], ["Move Site visit", "Cancel Site visit"]);
process.exit(bad ? 1 : 0);
