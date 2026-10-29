import { z } from "zod";

// What Claude hands back for each voice note: a short list of cards.
// Everything is spelled out so the answer always has the same shape.

export const CARD_TYPES = ["job", "calendar", "todo", "followup", "note"] as const;
export const JOB_STATUS_VALUES = ["consultation", "quoted", "booked", "in_progress", "done"] as const;

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
});

export const SortResult = z.object({ cards: z.array(Card) });
export type SortedCard = z.infer<typeof Card>;
