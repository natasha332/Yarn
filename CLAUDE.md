# Yarn

Yarn is a voice-first admin app for Australian tradies. A tradie taps one button and talks; the app turns what they said into calendar bookings, job notes, to-dos and (later) draft invoices and quotes. Every morning it sends a 7am "Today" briefing, and after work a day wrap-up, by email or push notification.

Promise to the user: **talk, don't type**. Nothing is saved or sent anywhere until the tradie taps Confirm on a card.

## About the owner

Natasha is building this herself with Claude Code and is not a professional developer. When working on this project:
- Work in small steps. Finish one thing, explain how to test it, then stop.
- Explain what you changed in plain English after each step.
- Tell me exactly what to click or type when I need to do something outside the code (Supabase dashboard, Netlify, Google Cloud).
- Commit to Git after each step that works, with a clear message.
- Never put API keys or passwords in code. Use environment variables (`.env.local`, and Netlify's environment settings), and make sure `.env*` is in `.gitignore`.
- If something is risky or hard to undo (deleting data, changing the database schema), say so and ask first.

## Tech stack

- Next.js (App Router, TypeScript), installable as a PWA, mobile-first
- Supabase: Postgres database, email login, file storage (audio), scheduled functions
- Hosting: Netlify
- Speech to text: OpenAI transcription API or Deepgram (to test both)
- Sorting transcripts into items: Claude API with structured JSON output
- Email: Resend. Push: standard web push from the PWA
- Styling: Tailwind CSS. Big tap targets; it's used with dirty hands and in the ute
- Default timezone: Australia/Sydney. Dates shown as "Tue 3 Nov", times as "9:00am"

## Data model (every table has business_id, protected by row-level security)

- **businesses**: id, name, timezone, morning_email_time, wrapup_mode, notify_channel (email, push, both), push_subscription, google_calendar_id, plan (base, accounting, quoting), trial_ends_at
- **users**: id, business_id, name, email, role (owner only for the MVP)
- **clients**: id, business_id, name, phone, email, address, aliases
- **jobs**: id, business_id, client_id, name, address, status (quoted, booked, in_progress, done)
- **captures**: id, business_id, user_id, audio_url, transcript, created_at, status (recorded, transcribed, sorted, failed)
- **items**: id, capture_id, business_id, type (calendar, todo, followup, note, invoice, quote, variation), title, client_id, job_id, due_date, start_time, end_time, details (JSON), status (pending, confirmed, discarded, done), external_id

## MVP scope (Base tier, $29/month)

1. Sign in, onboarding, clients and jobs
2. Capture screen: record (works offline, uploads later), transcribe, AI sorts into items, confirmation cards (Confirm, Edit, Discard)
3. Google Calendar: confirmed calendar items become events
4. Today screen: schedule, to-dos and follow-ups, job notes
5. 7am Today briefing and day wrap-up by email or push (tradie chooses)

Not in the MVP: crew logins, accounting integrations, quoting, SMS.

## Later tiers

- Accounting ($49): draft invoices to QuickBooks first, then Xero, then MYOB, behind one shared "accounting connector" interface
- Quoting ($69): voice-to-quote from the tradie's own price list, variations sent to clients for approval by SMS

## Build milestones (do these in order)

1. **Foundations**: project setup, Supabase auth, schema above with row-level security, Clients and Job screens. Done when Natasha can log in on her phone and add Fresh Joinery's real clients and jobs.
2. **Voice capture**: record in the browser, store audio, transcribe. Done when a note shows its transcript within 10 seconds.
3. **AI sorting and cards**: send transcript + today's date + timezone + client and job list to Claude, get back typed items, show confirmation cards. Ask instead of guessing when two clients match.
4. **Google Calendar and Today screen**.
5. **Scheduled briefing and wrap-up** (every 15 minutes, per-business timezone, logged so nobody gets duplicates).
6. **Field test** at Fresh Joinery for two weeks.

A clickable prototype of the Capture, Today and Emails screens exists as a reference for the look and flow.
