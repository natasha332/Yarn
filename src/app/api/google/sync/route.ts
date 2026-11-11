import { NextResponse, type NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/business";
import { googleConfig, refreshAccessToken } from "@/lib/google";
import { buildEvent, buildTimes, createEvent, deleteEvent, eventIdFor, updateEvent } from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-crypto";
import { blocked, crossSite } from "@/lib/same-origin";

// Makes Google Calendar match one Yarn booking. The browser only sends the booking's id.
// create: true  -> a booking that isn't in Google yet gets added (confirming a card, or "Add").
// create: false -> only follow up on a booking that is already there (moves and cancels).

type One = { name: string } | { name: string }[] | null;
const nameOf = (v: One) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null;
const reply = (status: string, message?: string) => NextResponse.json({ status, message });

export async function POST(request: NextRequest) {
  if (crossSite(request)) return blocked();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Please log in again." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  const create = body?.create === true;
  if (!itemId) return NextResponse.json({ status: "error", message: "Missing booking." }, { status: 400 });

  const config = googleConfig();
  const business = await getMyBusiness();
  if (!config || !business) return reply("not_connected");

  const { data: connection } = await supabase.from("google_connections").select("refresh_token_enc").maybeSingle();
  if (!connection) return reply("not_connected");

  // Row-level security means this only finds bookings in her own business.
  const { data: item } = await supabase
    .from("items")
    .select("id, type, status, title, due_date, start_time, end_time, external_id, details, clients(name), jobs(name)")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return NextResponse.json({ status: "error", message: "Couldn't find that booking." }, { status: 404 });
  if (item.type !== "calendar") return reply("skipped");

  const details = (item.details ?? {}) as Record<string, unknown>;
  const pending = details.calendar_sync;
  const action =
    item.status === "discarded" && item.external_id && pending === "needs_delete"
      ? "delete"
      : item.status === "confirmed" && item.external_id && pending === "needs_update"
        ? "update"
        : item.status === "confirmed" && !item.external_id && create && item.due_date
          ? "create"
          : null;
  if (!action) return reply("uptodate");

  let refreshToken: string;
  try {
    refreshToken = decryptToken(connection.refresh_token_enc);
  } catch {
    return reply("reconnect", "Yarn can't read the saved Google key. Reconnect in Settings.");
  }
  const { accessToken, error: tokenError } = await refreshAccessToken(config, refreshToken);
  if (!accessToken) {
    return tokenError === "invalid_grant"
      ? reply("reconnect", "Google needs you to connect again. Open Settings and tap Connect.")
      : reply("error", "Couldn't reach Google just now.");
  }

  const eventId = item.external_id ?? eventIdFor(item.id);
  let result;
  if (action === "delete") {
    result = await deleteEvent(accessToken, eventId);
  } else {
    const booking = {
      title: item.title,
      due_date: item.due_date!,
      start_time: item.start_time,
      end_time: item.end_time,
      details: item.details,
      clientName: nameOf(item.clients as One),
      jobName: nameOf(item.jobs as One),
    };
    result =
      action === "create"
        ? await createEvent(accessToken, eventId, buildEvent(booking, business.timezone))
        : await updateEvent(accessToken, eventId, buildTimes(booking, business.timezone));
  }
  if (!result.ok) {
    console.error("Google Calendar:", action, result.message);
    return result.reason === "auth"
      ? reply("reconnect", "Google didn't accept Yarn's access. Open Settings and connect again.")
      : reply("error", "Google Calendar didn't answer. Try again in a moment.");
  }

  // Done: remember the event, and clear the "needs doing" note.
  const { calendar_sync: _done, ...rest } = details;
  void _done;
  const { error: saveError } = await supabase
    .from("items")
    .update({
      external_id: action === "create" ? eventId : item.external_id,
      details: { ...rest, calendar_synced_at: new Date().toISOString() },
    })
    .eq("id", item.id);
  if (saveError) return reply("error", "It's in Google Calendar, but Yarn couldn't note that. Try again.");

  return reply(action === "create" ? "created" : action === "update" ? "updated" : "deleted");
}
