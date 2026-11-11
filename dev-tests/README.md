# Yarn tests

None of these touch your real Supabase, OpenAI, Anthropic, Google or Resend. They run against pretend copies.
They assume the project is checked out at `/home/user/Yarn` (as in a Claude Code cloud session).

## 1. Fast logic tests (no servers)
```bash
bash dev-tests/unit/run.sh
```
Includes `schemalimits.test.mts`: it counts the fields in the sorter's schema against Anthropic's limits
(max 16 nullable fields). **Run it whenever `src/lib/sort-schema.ts` changes.**

## 2. Database migrations on a throwaway Postgres
```bash
bash dev-tests/postgres/run.sh
```
Prints each step with what it should do ("expect ..."). Add a `tNNNN_name.sql` for every new migration.

## 3. The app, end to end (Playwright)
```bash
python3 dev-tests/killtest.py                       # stop leftovers from an earlier run
(setsid node dev-tests/fake/server.js &)            # pretend Supabase, OpenAI, Anthropic, Google, Resend on port 4000
NEXT_PUBLIC_SUPABASE_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npx next build
node dev-tests/e2e/cardstest.js                     # each file starts its own `next start` and prints PASS / FAIL
```
Run `killtest.py` and restart the pretend server between files. Files written for newer features
(`googleflow`, `emailtest`, `calendarmail`, `digestrun`, `briefingtest`, `googletest`, `emailclient`, `gmailflow`) run with
`node --experimental-strip-types` because they load Yarn's own TypeScript helpers.

What each covers: `cardstest`, `fitcards`, `layouttest` (cards and phone layout), `todaytest`, `reschedtest`,
`voiceresched` (move and cancel), `dupstest` (repeat detection), `sorttest`, `errtest`, `offlinetest`, `pwatest`,
`deltest`, `notestest`, `clearnotes` (recording, offline, notes), `googletest` (connect Google), `googleflow`
(events, reminders, moves), `emailtest` and `calendarmail` (briefing and wrap-up emails), `gmailflow` (connect Gmail, find an email, write and draft the reply), `digestrun`
(the 15-minute timer and no-duplicates), `briefingtest` (Daily emails settings), `emailclient` (emailing clients).
