import type { DuplicateOf } from "./duplicates";

// How each kind of card is named and coloured. Class names are written out in full so Tailwind sees them.
export const CARD_LABEL: Record<string, string> = {
  job: "New job",
  calendar: "Calendar",
  todo: "To-do",
  followup: "Follow-up",
  note: "Job note",
  invoice: "Invoice",
  quote: "Quote",
  variation: "Variation",
  reschedule: "Reschedule",
  cancel: "Cancel booking",
};

export const CARD_TEXT_CLASS: Record<string, string> = {
  job: "text-invoice",
  calendar: "text-cal",
  todo: "text-todo",
  followup: "text-followup",
  note: "text-note",
  invoice: "text-invoice",
  quote: "text-quote",
  variation: "text-variation",
  reschedule: "text-cal",
  cancel: "text-variation",
};

// A booking, as the Reschedule and Cancel cards describe it.
export type BookingSnapshot = {
  id: string;
  title: string;
  date: string;
  start: string | null;
  end: string | null;
  client: string | null;
};

export type CardDetails = {
  target_item_id?: string | null;
  target?: BookingSnapshot | null;
  target_options?: BookingSnapshot[];
  address?: string | null;
  notes?: string | null;
  job_status?: string | null;
  belongs_to_card?: number | null;
  new_client?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    nicknames?: string[];
  } | null;
  client_options?: { id: string; name: string }[];
  duplicate_of?: DuplicateOf | null;
};

// A card waiting on the home page, as the screen needs it.
export type PendingCard = {
  id: string;
  type: string;
  title: string;
  client_id: string | null;
  client_name: string | null;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  details: CardDetails;
  position: number;
};

// All the cards that came from one voice note.
export type ToCheckGroup = { key: string; when: string; cards: PendingCard[] };
