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
};

export type CardRow = {
  id: string;
  type: string;
  title: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  details: {
    address?: string | null;
    notes?: string | null;
    new_client?: { name: string } | null;
    client_options?: { id: string; name: string }[];
  } | null;
  status: string;
};
