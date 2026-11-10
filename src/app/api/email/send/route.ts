import { NextResponse, type NextRequest } from "next/server";
import { isEmail, renderClientEmail } from "@/lib/client-email";
import { loadSender } from "@/lib/email-sender";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";

// Sends an "email" card to the client, from the tradie's business name, with replies going to them.
// Only the card's id comes from the browser: the address, subject and message are read back from
// the saved card, and the card is claimed first so a double tap can never send it twice.

const reply = (status: string, message?: string, code = 200) =>
  NextResponse.json({ status, message }, { status: code });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply("error", "Please log in again.", 401);

  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) return reply("error", "Missing email.", 400);

  const sender = await loadSender(supabase, user);
  if (!sender) return reply("error", "Finish setting up your business first.", 409);

  // Row-level security means this only finds cards in her own business.
  const { data: item } = await supabase
    .from("items")
    .select("id, business_id, type, status, client_id, details")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return reply("error", "Couldn't find that email.", 404);
  if (item.type !== "email") return reply("error", "That isn't an email.", 400);
  if (item.status !== "pending") return reply("already", "That email has already been dealt with.", 409);

  const details = (item.details ?? {}) as Record<string, unknown> & {
    email?: { to?: string | null; subject?: string; body?: string };
    goes_with_item_id?: string | null;
  };
  const to = details.email?.to?.trim() ?? "";
  const subject = (details.email?.subject ?? "").trim();
  const text = (details.email?.body ?? "").trim();
  if (!isEmail(to)) return reply("error", "Add a valid email address first.", 400);
  if (!subject || subject.length > 200) return reply("error", "The email needs a subject (up to 200 characters).", 400);
  if (!text || text.length > 5000) return reply("error", "The email needs a message (up to 5000 characters).", 400);

  // An email about a move or cancel only goes once that change is confirmed.
  if (details.goes_with_item_id) {
    const { data: change } = await supabase
      .from("items")
      .select("status")
      .eq("id", details.goes_with_item_id)
      .maybeSingle();
    if (change?.status === "pending") return reply("blocked", "Confirm the change first, then send this.", 409);
    if (change?.status === "discarded") {
      return reply("blocked", "You discarded the change this email is about. Discard the email too.", 409);
    }
  }

  // Claim it. If someone else (a double tap) already did, stop here.
  const { data: claimed } = await supabase
    .from("items")
    .update({ status: "confirmed" })
    .eq("id", item.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return reply("already", "That email has already been sent.", 409);

  const { html, text: plain } = renderClientEmail(text);
  // "Send me a copy": a hidden copy to her own address (not when the client IS her own address).
  const copy =
    sender.copyToMe && sender.replyTo && isEmail(sender.replyTo) && sender.replyTo.toLowerCase() !== to.toLowerCase()
      ? [sender.replyTo]
      : undefined;
  const result = await sendEmail({
    to,
    subject,
    html,
    text: plain,
    fromName: sender.fromName,
    replyTo: sender.replyTo,
    bcc: copy,
  });

  const log = {
    business_id: item.business_id,
    item_id: item.id,
    client_id: item.client_id,
    to_email: to,
    subject,
    body: text,
  };
  if (!result.ok) {
    // Put it back so she can try again, and keep a note of what happened.
    await supabase
      .from("items")
      .update({ status: "pending", details: { ...details, send_error: result.message } })
      .eq("id", item.id);
    await supabase.from("sent_emails").insert({ ...log, status: "failed", error: result.message.slice(0, 300) });
    return reply(result.reason, result.message);
  }

  await supabase.from("sent_emails").insert({ ...log, status: "sent", resend_id: result.id });
  await supabase
    .from("items")
    .update({ details: { ...details, send_error: null, sent_at: new Date().toISOString() } })
    .eq("id", item.id);

  // A client with no email on file keeps the address she just used.
  if (item.client_id) {
    const { data: client } = await supabase.from("clients").select("email").eq("id", item.client_id).maybeSingle();
    if (client && !client.email) await supabase.from("clients").update({ email: to }).eq("id", item.client_id);
  }
  return NextResponse.json({ status: "sent", to });
}
