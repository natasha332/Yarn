// Spots when a new card (or a whole new note) repeats something already in Yarn.
// Plain functions with no database calls, so they are easy to test.

import { formatClock, formatDay } from "./format";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "for",
  "at",
  "on",
  "in",
  "of",
  "and",
  "with",
  "about",
  "my",
  "our",
  "up",
  "re",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "") // "Priya's" is one word, not "priya" and "s"
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}

// "consult" and "consultation" count as the same word.
function sameWord(a: string, b: string) {
  return (
    a === b ||
    (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))
  );
}

// 0 (nothing alike) to 1 (same words).
export function similarity(a: string, b: string): number {
  const A = [...new Set(words(a))];
  const B = [...new Set(words(b))];
  if (!A.length || !B.length) return 0;
  const common = A.filter((w) => B.some((x) => sameWord(w, x))).length;
  const jaccard = common / (A.length + B.length - common);
  // One title wrapped inside the other ("Order hinges" / "Order soft-close hinges"): still close.
  const inside =
    common === Math.min(A.length, B.length) && Math.min(A.length, B.length) >= 2
      ? 0.85
      : 0;
  return Math.max(jaccard, inside);
}

const CLOSE = 0.6; // wording alone has to be this alike
const CLOSE_IF_SAME_CLIENT = 0.45; // for jobs, the same client backs up looser wording
const CLOSE_IF_SAME_TIME = 0.4; // for bookings, the exact same day and time backs it up

export type ExistingItem = {
  id: string;
  type: string;
  title: string;
  due_date: string | null;
  start_time: string | null;
  client_id: string | null;
  job_id: string | null;
  new_client_name: string | null;
  status: string;
};
export type Candidate = {
  type: string;
  title: string;
  due_date: string | null;
  start_time: string | null;
  client_id: string | null;
  job_id: string | null;
  new_client_name: string | null;
};
export type ExistingJob = {
  id: string;
  name: string;
  client_id: string | null;
  status: string;
};
export type DuplicateOf = {
  kind: "card" | "job" | "note";
  id: string;
  title: string;
  status: string;
  label: string;
};

const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function describeItem(item: ExistingItem): string {
  const when = [
    item.due_date && formatDay(item.due_date),
    item.start_time && formatClock(item.start_time.slice(0, 5)),
  ]
    .filter(Boolean)
    .join(" · ");
  const state =
    item.status === "confirmed" ? "confirmed" : "waiting to be checked";
  return `“${item.title}” (${[state, when].filter(Boolean).join(" · ")})`;
}

export function findDuplicate(
  card: Candidate,
  items: ExistingItem[],
  jobs: ExistingJob[],
  clientNames: Map<string, string>,
): DuplicateOf | null {
  for (const other of items) {
    if (other.type !== card.type) continue;
    const alike = similarity(card.title, other.title);
    const sameClient = !!card.client_id && card.client_id === other.client_id;
    const sameJob = !!card.job_id && card.job_id === other.job_id;
    let dup = false;

    if (card.type === "calendar") {
      if (card.due_date && card.due_date === other.due_date) {
        const bothTimed = !!card.start_time && !!other.start_time;
        const sameTime =
          bothTimed &&
          card.start_time!.slice(0, 5) === other.start_time!.slice(0, 5);
        dup = bothTimed
          ? sameTime && (alike >= CLOSE_IF_SAME_TIME || sameClient || sameJob)
          : alike >= CLOSE;
      }
    } else if (card.type === "todo" || card.type === "followup") {
      const dateOk =
        !card.due_date || !other.due_date || card.due_date === other.due_date;
      dup = dateOk && alike >= CLOSE;
    } else if (card.type === "job") {
      const sameNewClient =
        !!card.new_client_name &&
        lower(card.new_client_name) === lower(other.new_client_name);
      dup = alike >= CLOSE_IF_SAME_CLIENT && (sameClient || sameNewClient);
    } else {
      dup = alike >= 0.8 && (!card.job_id || !other.job_id || sameJob);
    }

    if (dup)
      return {
        kind: "card",
        id: other.id,
        title: other.title,
        status: other.status,
        label: describeItem(other),
      };
  }

  if (card.type === "job") {
    for (const job of jobs) {
      const clientName = job.client_id
        ? clientNames.get(job.client_id)
        : undefined;
      const sameClient =
        (!!card.client_id && card.client_id === job.client_id) ||
        (!!card.new_client_name &&
          !!clientName &&
          lower(clientName) === lower(card.new_client_name));
      if (
        sameClient &&
        similarity(card.title, job.name) >= CLOSE_IF_SAME_CLIENT
      ) {
        return {
          kind: "job",
          id: job.id,
          title: job.name,
          status: job.status,
          label: `the job “${job.name}”${clientName ? ` for ${clientName}` : ""}`,
        };
      }
    }
  }
  return null;
}

// Is this whole note a repeat of an earlier one? (Recorded twice, or the same words said again.)
export function findRepeatedNote(
  transcript: string,
  earlier: { id: string; transcript: string | null }[],
): DuplicateOf | null {
  if (words(transcript).length < 4) return null;
  for (const note of earlier) {
    if (note.transcript && similarity(transcript, note.transcript) >= 0.85) {
      const snippet =
        note.transcript.length > 60
          ? `${note.transcript.slice(0, 57)}…`
          : note.transcript;
      return {
        kind: "note",
        id: note.id,
        title: snippet,
        status: "",
        label: `an earlier note: “${snippet}”`,
      };
    }
  }
  return null;
}
