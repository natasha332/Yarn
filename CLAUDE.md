# Yarn

Yarn is a voice-first admin app for Australian tradies. A tradie taps one button and talks; the app turns what they said into calendar bookings, job notes, to-dos and (later) draft invoices and quotes. Every morning it sends a 7am "Today" briefing, and after work a day wrap-up, by email or push notification.

Promise to the user: **talk, don't type**. Nothing is saved or sent anywhere until the tradie taps Confirm (or Send, for an email) on a card.

## Product direction

Yarn will be sold on subscription to many tradies. The business Natasha tests with is only customer #1: nothing may be hard-wired to one business. Every table has `business_id`, secrets and connections are per business, and a business's name, sender name, reply-to address and sign-off are settings, not code. Prefer designs that work for any email provider and any customer; avoid anything that needs a per-customer manual setup.

Email decision: Yarn writes emails to a tradie's clients itself and sends them through Resend, in the business's name with Reply-To set to the tradie. It does NOT read or write a tradie's inbox: Gmail mail scopes are "restricted" and need Google's yearly security assessment, and customers use many providers. A connected-inbox add-on (Gmail, then Outlook) may come later, behind its own interface.

## About the owner

Natasha is building this herself with Claude Code and is not a professional developer. When working on this project:
- Work in small steps. Finish one thing, explain how to test it, then stop.
- Explain what you changed in plain English after each step.
- Tell me exactly what to click or type when I need to do something outside the code (Supabase dashboard, Netlify, Google Cloud).
- Commit to Git after each step that works, with a clear message.
- Never put API keys or passwords in code. Use environment variables (`.env.local`, and Netlify's environment settings), and make sure `.env*` is in `.gitignore`.
- If something is risky or hard to undo (deleting data, changing the database schema), say so and ask first.

## Tech stack

- Next.js (App Router, TypeScript), installable as a PWA, mobile-first. This Next.js is newer than most training data (cacheComponents, `proxy.ts`, `PageProps<>`): read `node_modules/next/dist/docs/` before changing framework-level code
- Supabase: Postgres database with row-level security, email login, file storage (audio, private bucket). Schema changes are numbered SQL files in `supabase/migrations/`, run by hand in the Supabase SQL Editor
- Hosting: Netlify. Each production deploy costs credits: commit SQL-only and docs-only changes with `[skip netlify] [skip ci]` in the message
- Speech to text: OpenAI (`gpt-4o-transcribe`)
- Sorting transcripts into items: Claude API with structured JSON output (`messages.parse` + Zod). Anthropic limits a structured-output schema to 16 nullable fields: the sort schema uses 14, so new fields must be plain required fields ("none", "" or -1 for "not applicable"). Check with the schema-limits test in `dev-tests/`
- Google Calendar: OAuth (scopes `calendar.events openid email`), one connection per business in `google_connections`, refresh token encrypted (AES-256-GCM, key from `GOOGLE_TOKEN_KEY`). Events use the booking's id as their Google event id, so a retry can never double-create. Every event gets a 30 minute popup reminder
- Email: Resend. Briefing and wrap-up come from `EMAIL_FROM` (needs a verified domain); client emails use the same address with the business's name and Reply-To
- Timer: Netlify scheduled function `netlify/functions/digest-cron.mts` calls `/api/cron/digest` every 15 minutes with `CRON_SECRET`; each email is claimed in `digest_log` first so nobody gets a duplicate. The run uses `SUPABASE_SECRET_KEY` (very powerful, Netlify only)
- Push: standard web push from the PWA (not built yet)
- Styling: Tailwind CSS. Big tap targets; it's used with dirty hands and in the ute
- Default timezone: Australia/Sydney. Dates shown as "Tue 3 Nov", times as "9:00am"

## Data model (every table has business_id, protected by row-level security)

- **businesses**: id, name, timezone, morning_enabled, morning_email_time, wrapup_mode (end_of_day, off), wrapup_time, notify_channel (email, push, both), push_subscription, google_calendar_id, email_from_name, email_reply_to, email_sign_off, plan (base, accounting, quoting), trial_ends_at
- **users**: id, business_id, name, email, role (owner only for the MVP)
- **clients**: id, business_id, name, phone, email, address, aliases
- **jobs**: id, business_id, client_id, name, address, status (consultation, quoted, booked, in_progress, done; shown as "Consultation", "Quoted", "Booked job", "Job in progress", "Done")
- **captures**: id, business_id, user_id, audio_url, transcript, created_at, status (recorded, transcribed, sorted, failed)
- **items**: id, capture_id, business_id, type (calendar, todo, followup, note, job, invoice, quote, variation, reschedule, cancel, email), title, client_id, job_id, due_date, start_time, end_time, details (JSON), status (pending, confirmed, discarded, done), external_id (the Google event id), position, done_at (set automatically when ticked off). A cancelled booking is kept as `discarded` with `details.cancelled_at`. `details.calendar_sync` ('needs_update' / 'needs_delete') marks a booking whose Google event still has to follow a move or cancel. An `email` card holds `details.email` {to, subject, body, kind}; it can only be sent through `/api/email/send` (`confirm_item` refuses emails)
- **google_connections**: business_id, google_email, refresh_token_enc, connected_at
- **digest_log**: business_id, kind (morning, wrapup), local_date, status, attempts, to_email, error. One row per business per kind per day: the claim that stops duplicate emails
- **sent_emails**: business_id, item_id, client_id, to_email, subject, status (sent, failed), resend_id, error: a record of every client email

## MVP scope (Base tier, $29/month)

1. Sign in, onboarding, clients and jobs
2. Capture screen: record (works offline, uploads later), transcribe, AI sorts into items, confirmation cards (Confirm, Edit, Discard)
3. Google Calendar: confirmed calendar items become events with a 30 minute reminder; moving or cancelling a booking (buttons or voice) updates or removes the event
4. Today screen: schedule (Yarn bookings), to-dos and follow-ups, job notes, reschedule and cancel
5. 7am Today briefing and day wrap-up by email, listing Yarn bookings plus other timed events on the main Google calendar; push is not built yet
6. Emailing clients: "let her know" notices for a move or cancel, and free-form emails by voice. Each is an Email card the tradie reads and sends

Not in the MVP: crew logins, accounting integrations, quoting, SMS, reading a tradie's inbox.

## Later tiers

- Accounting ($49): draft invoices to QuickBooks first, then Xero, then MYOB, behind one shared "accounting connector" interface
- Quoting ($69): voice-to-quote from the tradie's own price list, variations sent to clients for approval by SMS

## Build milestones (do these in order)

1. **Foundations**: project setup, Supabase auth, schema above with row-level security, Clients and Job screens. Done when Natasha can log in on her phone and add Fresh Joinery's real clients and jobs.
2. **Voice capture**: record in the browser, store audio, transcribe. Done when a note shows its transcript within 10 seconds.
3. **AI sorting and cards**: send transcript + today's date + timezone + client and job list to Claude, get back typed items, show confirmation cards. Ask instead of guessing when two clients match.
4. **Google Calendar and Today screen**. Done.
5. **Scheduled briefing and wrap-up** (every 15 minutes, per-business timezone, logged so nobody gets duplicates). Done by email; push notifications still to build.
6. **Emailing clients** (reschedule and cancel notices, voice emails). Done.
7. **Field test** at Fresh Joinery for two weeks.

Still to do: reply to a client's email by voice ("Open in my email app", no inbox access), push notifications, and publishing the Google app (while it is in "Testing", Google disconnects the calendar about weekly; for other customers it needs Google's verification, and the Gmail-inbox add-on would need the security assessment).

## Where things are

- Environment variables (all secret ones live only in `.env.local` and Netlify): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. See `.env.example`
- Tests: `dev-tests/` (see its README). They run against pretend Supabase, OpenAI, Anthropic, Google and Resend servers, plus a throwaway Postgres for every migration. Run the relevant ones before pushing, and add one for anything new

A clickable prototype of the Capture, Today and Emails screens exists as a reference for the look and flow.
