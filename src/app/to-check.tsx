import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import type { ToCheckGroup } from "@/lib/cards";
import ToCheckList from "./to-check-list";

// Cards the sorter made that are still waiting for you to confirm, edit or discard.
// They stay here until you deal with them: they don't expire.
export default async function ToCheck() {
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select(
      "id, capture_id, type, title, client_id, job_id, due_date, start_time, end_time, details, position, created_at, captures(created_at), clients(name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .order("position");

  // One group per voice note, newest first.
  const groups: ToCheckGroup[] = [];
  for (const raw of items ?? []) {
    const capture = Array.isArray(raw.captures)
      ? raw.captures[0]
      : raw.captures;
    const client = Array.isArray(raw.clients) ? raw.clients[0] : raw.clients;
    const key = raw.capture_id ?? raw.id;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, when: capture?.created_at ?? raw.created_at, cards: [] };
      groups.push(group);
    }
    group.cards.push({
      id: raw.id,
      type: raw.type,
      title: raw.title,
      client_id: raw.client_id,
      client_name: client?.name ?? null,
      due_date: raw.due_date,
      start_time: raw.start_time,
      end_time: raw.end_time,
      details: raw.details ?? {},
      position: raw.position,
    });
  }

  // Inside a note, cards go in the order they were made (the new job comes before its booking).
  for (const group of groups)
    group.cards.sort((a, b) => a.position - b.position);

  if (groups.length === 0) return null;
  return <ToCheckList groups={groups} timezone={business.timezone} />;
}
