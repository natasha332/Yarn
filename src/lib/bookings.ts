// Works out what a spoken "move..." or "cancel..." means, given your upcoming bookings.
// Plain functions with no database calls, so they are easy to test.

export type Booking = {
  id: string;
  title: string;
  date: string; // "2026-11-03"
  start: string | null; // "09:00"
  end: string | null;
  client: string | null;
};

export type ChangeInput = {
  type: "reschedule" | "cancel";
  title: string;
  target_booking_id: string | null;
  target_options: string[];
  date: string | null; // the NEW values, already checked
  start_time: string | null;
  end_time: string | null;
};

export type ResolvedChange = {
  targetId: string | null; // the booking to change, if it's clear
  target: Booking | null;
  options: Booking[]; // when it isn't clear: the bookings to choose from
  title: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  alreadyThere: boolean; // a "move" to exactly where it already is
};

export function resolveChange(
  card: ChangeInput,
  bookings: Booking[],
): ResolvedChange {
  const byId = new Map(bookings.map((b) => [b.id, b]));

  let targetId =
    card.target_booking_id && byId.has(card.target_booking_id)
      ? card.target_booking_id
      : null;
  let options = targetId
    ? []
    : [...new Set(card.target_options)]
        .filter((id) => byId.has(id))
        .map((id) => byId.get(id)!);

  // The sorter named one booking after all: that's the answer.
  if (!targetId && options.length === 1) {
    targetId = options[0].id;
    options = [];
  }
  // It couldn't tell: offer the nearest few instead of leaving you stuck.
  if (!targetId && options.length === 0) options = bookings.slice(0, 6);

  const target = targetId ? (byId.get(targetId) ?? null) : null;

  let due_date: string | null = null;
  let start_time: string | null = null;
  let end_time: string | null = null;
  if (card.type === "reschedule") {
    due_date = card.date ?? target?.date ?? null;
    if (card.start_time === null) {
      // Only a new day was said: the time stays as it was.
      start_time = target?.start ?? null;
      end_time = card.end_time ?? target?.end ?? null;
    } else {
      start_time = card.start_time;
      end_time = card.end_time;
    }
  }

  const verb = card.type === "cancel" ? "Cancel" : "Move";
  const title =
    card.title.trim().slice(0, 200) ||
    (target ? `${verb} ${target.title}` : `${verb} a booking`);

  const alreadyThere =
    card.type === "reschedule" &&
    !!target &&
    due_date === target.date &&
    start_time === target.start;

  return {
    targetId,
    target,
    options,
    title,
    due_date,
    start_time,
    end_time,
    alreadyThere,
  };
}
