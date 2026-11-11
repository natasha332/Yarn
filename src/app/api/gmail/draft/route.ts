import { NextResponse, type NextRequest } from "next/server";
import { isEmail } from "@/lib/client-email";
import { createDraft, gmailAccess } from "@/lib/gmail";
import type { GmailState } from "@/lib/gmail-reply";
import { createClient } from "@/lib/supabase/server";
import { blocked, crossSite } from "@/lib/same-origin";

// "Save to Gmail drafts": puts the reply in the tradie's Gmail as a DRAFT, in the same conversation.
// Yarn has no permission to send from Gmail, so the tradie presses Send in Gmail themselves.
// The card is claimed first, so a double tap can't make two drafts.

const reply = (status: string, message?: string, code = 200) =>
  NextResponse.json({ status, message }, { status: code });

export async function POST(request: NextRequest) {
  if (crossSite(request)) return blocked();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply("error", "Please log in again.", 401);
  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) return reply("error", "Missing card.", 400);

  const { data: item } = await supabase
    .from("items")
    .select("id, business_id, type, status, client_id, details")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.type !== "email") return reply("error", "Couldn't find that email.", 404);
  if (item.status !== "pending") return reply("already", "That one has already been dealt with.", 409);

  const details = (item.details ?? {}) as Record<string, unknown> & {
    email?: { to?: string | null; subject?: string; body?: string };
    gmail?: GmailState;
  };
  const gm = details.gmail;
  const to = details.email?.to?.trim() ?? "";
  const subject = (details.email?.subject ?? "").trim();
  const text = (details.email?.body ?? "").trim();
  if (!gm || gm.state !== "ready" || !gm.thread_id) return reply("error", "This reply isn't ready yet.", 409);
  if (!isEmail(to)) return reply("error", "Add a valid email address first.", 400);
  if (!subject || !text || text.length > 5000) return reply("error", "The email needs a subject and a message.", 400);

  const access = await gmailAccess(supabase, item.business_id);
  if (!access.ok) {
    return reply(
      "error",
      access.reason === "not_connected" ? "Gmail isn't connected." : "Gmail needs connecting again. Open Settings and tap Connect Gmail.",
    );
  }

  const { data: claimed } = await supabase
    .from("items")
    .update({ status: "confirmed" })
    .eq("id", item.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return reply("already", "That one has already been dealt with.", 409);

  try {
    const { draftId } = await createDraft(access.accessToken, {
      threadId: gm.thread_id,
      to,
      subject,
      body: text,
      inReplyTo: gm.message_id || undefined,
      references: gm.references || undefined,
    });
    await supabase
      .from("items")
      .update({ details: { ...details, gmail: { ...gm, draft_id: draftId } } })
      .eq("id", item.id);
  } catch (e) {
    console.error("gmail draft failed:", e instanceof Error ? e.message : e);
    await supabase.from("items").update({ status: "pending" }).eq("id", item.id);
    return reply("error", "Couldn't save the draft in Gmail. Try again in a moment.");
  }

  // The address she replied to is kept on the client for next time.
  if (item.client_id) {
    const { data: client } = await supabase.from("clients").select("email").eq("id", item.client_id).maybeSingle();
    if (client && !client.email) await supabase.from("clients").update({ email: to }).eq("id", item.client_id);
  }
  return NextResponse.json({
    status: "saved",
    url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(access.email ?? "")}#drafts`,
  });
}
