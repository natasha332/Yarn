import { z } from "zod";

// What Claude hands back for each voice note: a short list of cards.
// Everything is spelled out so the answer always has the same shape.

export const CARD_TYPES = [
  "job",
  "calendar",
  "todo",
  "followup",
  "note",
  "reschedule",
  "cancel",
  "email",
] as const;
export const JOB_STATUS_VALUES = [
  "consultation",
  "quoted",
  "booked",
  "in_progress",
  "done",
] as const;

const NewClient = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  nicknames: z.array(z.string()),
});

const Card = z.object({
  type: z.enum(CARD_TYPES),
  title: z.string(),
  date: z.string().nullable(), // YYYY-MM-DD
  start_time: z.string().nullable(), // HH:MM, 24 hour
  end_time: z.string().nullable(),
  client_id: z.string().nullable(), // an id from the client list, only when exactly one client fits
  client_options: z.array(z.string()), // ids from the client list, when two or more could fit
  job_id: z.string().nullable(), // an id from the job list
  new_client: NewClient.nullable(), // only on "job" cards, for someone who isn't a client yet
  job_status: z.enum(JOB_STATUS_VALUES).nullable(), // only on "job" cards
  address: z.string().nullable(),
  notes: z.string().nullable(),
  belongs_to_card: z.number().int().nullable(), // 0-based position of the "job" card this goes with
  target_booking_id: z.string().nullable(), // "reschedule" and "cancel" cards: the id of the booking, from the bookings list
  target_options: z.array(z.string()), // ids of the bookings it could be, when two or more fit
  // "email" cards only. These are plain required fields with "none" / "" / -1 meaning "not applicable",
  // NOT nullable ones: Anthropic's structured output allows at most 16 nullable fields in a schema,
  // and the fields above already use 14 of them.
  email_kind: z.enum(["none", "reschedule", "cancel", "other"]),
  email_note: z.string(), // about a move or cancel: the reason, as one friendly sentence ("" if none)
  email_subject: z.string(), // kind "other" ("" otherwise)
  email_body: z.string(), // kind "other": the message, without greeting or sign-off ("" otherwise)
  goes_with_card: z.number().int(), // 0-based position of the reschedule or cancel card the email is about (-1 if none)
});

export const SortResult = z.object({ cards: z.array(Card) });
export type SortedCard = z.infer<typeof Card>;
