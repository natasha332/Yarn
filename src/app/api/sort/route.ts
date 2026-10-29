import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse, type NextRequest } from "next/server";
import {
  findDuplicate,
  findRepeatedNote,
  type ExistingItem,
} from "@/lib/duplicates";
import { SORT_SYSTEM_PROMPT } from "@/lib/sort-prompt";
import { SortResult, type SortedCard } from "@/lib/sort-schema";
import { createClient } from "@/lib/supabase/server";

// Sorts a written-down voice note into cards (calendar, to-do, new job...) for the tradie to check.
// Nothing here is final: cards are saved as "pending" until the tradie confirms them.

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

const isDate = (s: string | null) =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isTime = (s: string | null) => !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// "Tuesday 2026-10-27", worked out in the business's own timezone.
function todayIn(timeZone: string) {
  const now = new Date();
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const weekday = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "long",
  }).format(now);
  return `${weekday} ${iso}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("Sorting isn't set up yet.", 503);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Please log in again.", 401);

  const body = await request.json().catch(() => null);
  const captureId = typeof body?.captureId === "string" ? body.captureId : null;
  if (!captureId) return fail("Missing capture.", 400);

  // Row-level security means all of these only ever find the person's own business.
  const { data: business } = await supabase
    .from("businesses")
    .select("id, timezone")
    .maybeSingle();
  if (!business) return fail("Finish setting up your business first.", 409);

  const { data: capture } = await supabase
    .from("captures")
    .select("id, transcript")
    .eq("id", captureId)
    .maybeSingle();
  if (!capture) return fail("Couldn't find that note.", 404);
  if (!capture.transcript)
    return fail("This note hasn't been written down yet.", 409);

  // Already sorted (a double tap, a retry): hand back what's there.
  const existing = await supabase
    .from("items")
    .select(
      "id, type, title, due_date, start_time, end_time, details, status, position",
    )
    .eq("capture_id", captureId)
    .order("position");
  if (existing.data?.length) return NextResponse.json({ cards: existing.data });

  const [{ data: clients }, { data: jobs }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, aliases, address")
      .order("name")
      .limit(300),
    supabase
      .from("jobs")
      .select("id, name, client_id, status, address")
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  // What's already in Yarn from the last 30 days, so a repeat can be spotted.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: pastItems }, { data: pastNotes }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, type, title, due_date, start_time, client_id, job_id, details, status",
      )
      .in("status", ["pending", "confirmed"])
      .or(`capture_id.is.null,capture_id.neq.${captureId}`)
      .gte("created_at", since)
      .limit(400),
    supabase
      .from("captures")
      .select("id, transcript")
      .neq("id", captureId)
      .not("transcript", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const pastCards: ExistingItem[] = (pastItems ?? []).map((i) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    due_date: i.due_date,
    start_time: i.start_time,
    client_id: i.client_id,
    job_id: i.job_id,
    new_client_name: i.details?.new_client?.name ?? null,
    status: i.status,
  }));
  const repeatedNote = findRepeatedNote(
    capture.transcript,
    (pastNotes ?? []).filter((n) => n.id !== captureId),
  );
  const clientIds = new Set((clients ?? []).map((c) => c.id));
  const jobIds = new Set((jobs ?? []).map((j) => j.id));

  const anthropic = new Anthropic({ apiKey });
  let sorted: SortedCard[];
  try {
    const response = await anthropic.messages.parse({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
      max_tokens: 4000,
      system: SORT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `TODAY: ${todayIn(business.timezone)} (timezone ${business.timezone})\n\n` +
            `CLIENTS (JSON):\n${JSON.stringify(clients ?? [])}\n\n` +
            `OPEN JOBS (JSON):\n${JSON.stringify(jobs ?? [])}\n\n` +
            `VOICE NOTE:\n${capture.transcript}`,
        },
      ],
      output_config: { effort: "low", format: zodOutputFormat(SortResult) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.error("sort: no usable answer", response.stop_reason);
      return fail("Couldn't sort this one. Try again.", 502);
    }
    sorted = response.parsed_output.cards;
  } catch (err) {
    console.error(
      "sort: Anthropic error",
      err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err,
    );
    if (err instanceof Anthropic.AuthenticationError)
      return fail(
        "Anthropic rejected the key. Check ANTHROPIC_API_KEY in Netlify.",
        502,
      );
    if (err instanceof Anthropic.RateLimitError)
      return fail("The sorter is busy right now. Try again in a moment.", 502);
    if (err instanceof Anthropic.APIError)
      return fail(`The sorter said no (${err.status}). Try again.`, 502);
    return fail("Couldn't reach the sorter. Try again.", 502);
  }

  // Never trust ids, dates or times blindly: keep only what checks out.
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const rows = sorted.map((card, position) => {
    const clientId =
      card.client_id && clientIds.has(card.client_id) ? card.client_id : null;
    const options = clientId
      ? []
      : card.client_options.filter((id) => clientIds.has(id));
    const dueDate = isDate(card.date) ? card.date : null;
    const startTime = isTime(card.start_time) ? card.start_time : null;
    const jobId = card.job_id && jobIds.has(card.job_id) ? card.job_id : null;
    const duplicateOf =
      findDuplicate(
        {
          type: card.type,
          title: card.title,
          due_date: dueDate,
          start_time: startTime,
          client_id: clientId,
          job_id: jobId,
          new_client_name:
            card.type === "job" ? (card.new_client?.name ?? null) : null,
        },
        pastCards,
        jobs ?? [],
        names,
      ) ?? repeatedNote;
    return {
      capture_id: captureId,
      business_id: business.id,
      type: card.type,
      title: card.title.trim().slice(0, 200) || "Untitled",
      client_id: clientId,
      job_id: jobId,
      due_date: dueDate,
      start_time: startTime,
      end_time: isTime(card.end_time) ? card.end_time : null,
      details: {
        address: card.address,
        notes: card.notes,
        new_client: card.type === "job" ? card.new_client : null,
        job_status:
          card.type === "job" ? (card.job_status ?? "consultation") : null,
        client_options: options.map((id) => ({
          id,
          name: names.get(id) ?? "",
        })),
        duplicate_of: duplicateOf,
        belongs_to_card:
          card.belongs_to_card !== null &&
          sorted[card.belongs_to_card]?.type === "job"
            ? card.belongs_to_card
            : null,
      },
      status: "pending",
      position,
    };
  });

  if (rows.length) {
    const { error } = await supabase.from("items").insert(rows);
    if (error) {
      console.error("sort: couldn't save cards", error.message);
      return fail("Sorted it, but couldn't save the cards. Try again.", 500);
    }
  }
  await supabase
    .from("captures")
    .update({ status: "sorted" })
    .eq("id", captureId);

  const { data: cards } = await supabase
    .from("items")
    .select(
      "id, type, title, due_date, start_time, end_time, details, status, position",
    )
    .eq("capture_id", captureId)
    .order("position");
  return NextResponse.json({ cards: cards ?? [] });
}
