import { NextResponse, type NextRequest } from "next/server";
import { composeBookingEmail } from "@/lib/client-email";
import { getMyBusiness } from "@/lib/business";
import { loadSender } from "@/lib/email-sender";
import { createClient } from "@/lib/supabase/server";

// After she moves or cancels a booking with the buttons on Today, this writes the "let the client
// know" email as a card in To check. It only writes the card: nothing is sent until she taps Send.

const reply = (status: string, message?: string, code = 200) =>
  NextResponse.json({ status, message }, { status: code });

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d/.test(s);

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply("error", "Please log in again.", 401);

  const body = await request.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" ? body.bookingId : null;
  const kind = body?.kind === "reschedule" || body?.kind === "cancel" ? body.kind : null;
  if (!bookingId || !kind) return reply("error", "Missing booking.", 400);

  const business = await getMyBusiness();
  const sender = await loadSender(supabase, user);
  if (!business || !sender) return reply("error", "Finish setting up your business first.", 409);

  const { data: booking } = await supabase
    .from("items")
    .select("id, type, status, client_id, title, due_date, start_time, details, clients(name, email)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.type !== "calendar") return reply("error", "Couldn't find that booking.", 404);
  if (!booking.client_id || !booking.due_date) return reply("error", "This booking has no client to email.", 400);
  if (kind === "reschedule" && booking.status !== "confirmed") return reply("error", "That booking isn't active.", 409);
  if (kind === "cancel" && booking.status !== "discarded") return reply("error", "That booking isn't cancelled.", 409);

  // Already waiting in To check for this change? Don't make a second one.
  const { data: waiting } = await supabase
    .from("items")
    .select("id, details")
    .eq("type", "email")
    .eq("status", "pending")
    .limit(50);
  const duplicate = (waiting ?? []).find(
    (w) => w.details?.target_item_id === bookingId && w.details?.email?.kind === kind,
  );
  if (duplicate) return NextResponse.json({ status: "exists", id: duplicate.id });

  const client = one(booking.clients as One<{ name: string; email: string | null }>);
  const start = booking.start_time ? booking.start_time.slice(0, 5) : null;
  const old = {
    date: kind === "reschedule" && isDate(body?.oldDate) ? body.oldDate : booking.due_date,
    start: kind === "reschedule" ? (isTime(body?.oldStart) ? body.oldStart.slice(0, 5) : body?.oldStart === null ? null : start) : start,
  };
  const composed = composeBookingEmail({
    kind,
    clientName: client?.name ?? null,
    bookingTitle: booking.title,
    old,
    next: { date: booking.due_date, start },
    signOff: sender.signOff,
  });

  const { data: created, error } = await supabase
    .from("items")
    .insert({
      business_id: business.id,
      type: "email",
      title: composed.subject,
      client_id: booking.client_id,
      status: "pending",
      position: 0,
      details: {
        email: { to: client?.email ?? null, subject: composed.subject, body: composed.body, kind },
        target_item_id: bookingId,
      },
    })
    .select("id")
    .single();
  if (error || !created) return reply("error", "Couldn't write the email.", 500);
  return NextResponse.json({ status: "created", id: created.id });
}
