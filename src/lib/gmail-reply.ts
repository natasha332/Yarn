import type { SupabaseClient } from "@supabase/supabase-js";
import { composeOtherEmail, firstName } from "@/lib/client-email";
import { loadSender } from "@/lib/email-sender";
import { findCandidates, gmailAccess, readThread, searchQuery, withRe, type Candidate } from "@/lib/gmail";
import { writeReply } from "@/lib/reply-writer";

// The "reply to Robyn" flow, one request at a time so each has its own time allowance:
//   prepare  -> looks for the email in Gmail; one match goes straight on, several ask "which one?"
//   choose   -> she picked one
// Both end the same way: the reply is written and saved ON THE CARD for her to read. Nothing goes to Gmail
// until she taps "Save to Gmail drafts".

export type GmailState = {
  state: "lookup" | "choose" | "ready" | "none" | "error";
  instruction: string; // her words
  hint: string; // a word or two to narrow the search, like "quote"
  message?: string;
  candidates?: Candidate[];
  thread_id?: string;
  message_id?: string;
  references?: string;
  subject?: string;
  draft_id?: string;
};

export type PrepareResult = { status: GmailState["state"] | "skipped"; message?: string };

type Item = { id: string; business_id: string; type: string; status: string; client_id: string | null; details: Record<string, unknown> | null };

export async function prepareReply(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  itemId: string,
  chosenThreadId?: string,
): Promise<PrepareResult> {
  const sender = await loadSender(supabase, user);
  const { data: item } = (await supabase
    .from("items")
    .select("id, business_id, type, status, client_id, details")
    .eq("id", itemId)
    .maybeSingle()) as { data: Item | null };
  if (!sender || !item || item.type !== "email" || item.status !== "pending") return { status: "skipped" };
  const details = item.details ?? {};
  const gm = details.gmail as GmailState | undefined;
  if (!gm || (chosenThreadId ? gm.state !== "choose" : gm.state !== "lookup")) return { status: "skipped" };

  const save = async (next: Partial<GmailState>, email?: { to: string | null; subject: string; body: string; kind: string }, title?: string) => {
    const merged = { ...gm, ...next };
    if (next.state !== "choose") delete merged.candidates;
    await supabase
      .from("items")
      .update({ ...(title ? { title } : {}), details: { ...details, gmail: merged, ...(email ? { email } : {}) } })
      .eq("id", item.id);
  };

  const { data: client } = item.client_id
    ? await supabase.from("clients").select("name, aliases, email").eq("id", item.client_id).maybeSingle()
    : { data: null };

  // If this can't be done, she still gets a normal email card she can fill in and send from Yarn.
  const fallback = async (state: "none" | "error", message: string) => {
    const plain = composeOtherEmail({
      clientName: client?.name ?? null,
      subject: gm.hint || null,
      message: gm.instruction,
      businessName: sender.businessName,
      signOff: sender.signOff,
    });
    await save({ state, message }, { to: client?.email ?? null, subject: plain.subject, body: plain.body, kind: "other" }, plain.subject);
    return { status: state, message } as PrepareResult;
  };

  if (!client) return fallback("none", "I couldn't tell which client this is for, so I couldn't look for their email.");

  const access = await gmailAccess(supabase, item.business_id);
  if (!access.ok) {
    return fallback(
      "error",
      access.reason === "not_connected"
        ? "Gmail isn't connected. Connect it in Settings, or write this email yourself."
        : access.reason === "reconnect"
          ? "Gmail needs connecting again. Open Settings and tap Connect Gmail."
          : "Couldn't reach Gmail just now.",
    );
  }

  try {
    let threadId = chosenThreadId;
    if (threadId) {
      if (!(gm.candidates ?? []).some((c) => c.threadId === threadId)) return { status: "skipped" };
    } else {
      const candidates = await findCandidates(access.accessToken, searchQuery(client, gm.hint), access.email);
      if (candidates.length === 0) {
        return fallback("none", `I couldn't find an email from ${firstName(client.name) || "them"} in the last 3 months. You can write it yourself, or add their address.`);
      }
      if (candidates.length > 1) {
        await save({ state: "choose", candidates });
        return { status: "choose" };
      }
      threadId = candidates[0].threadId;
    }

    const ctx = await readThread(access.accessToken, threadId, access.email);
    if (!ctx || !ctx.replyToAddress) return fallback("none", "I found the conversation but couldn't see who to reply to.");

    let body: string;
    try {
      body = await writeReply({ instruction: gm.instruction, clientName: client.name, excerpt: ctx.excerpt });
    } catch (e) {
      console.error("gmail reply: writer failed", e instanceof Error ? e.message : e);
      return fallback("error", "Couldn't write the reply just now. Try again, or write it yourself.");
    }

    const composed = composeOtherEmail({
      clientName: ctx.replyToName || client.name,
      subject: withRe(ctx.subject),
      message: body,
      businessName: sender.businessName,
      signOff: sender.signOff,
    });
    await save(
      { state: "ready", thread_id: ctx.threadId, message_id: ctx.messageId, references: ctx.references, subject: ctx.subject, message: undefined },
      { to: ctx.replyToAddress, subject: composed.subject, body: composed.body, kind: "reply" },
      composed.subject,
    );
    return { status: "ready" };
  } catch (e) {
    console.error("gmail reply failed:", e instanceof Error ? e.message : e);
    return fallback("error", "Couldn't read your Gmail just now. Try again in a moment.");
  }
}
