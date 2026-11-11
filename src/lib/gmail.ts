import type { SupabaseClient } from "@supabase/supabase-js";
import { googleConfig, refreshAccessToken } from "@/lib/google";
import { decryptToken } from "@/lib/token-crypto";

// Finding an email in the tradie's Gmail, reading the conversation, and saving a reply as a DRAFT.
// Yarn only ever reads what it is asked about and only ever creates drafts: it has no permission to send.

const API =
  process.env.GMAIL_API_URL ?? "https://gmail.googleapis.com/gmail/v1/users/me";

export type Candidate = {
  threadId: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  date: string; // ISO
  snippet: string;
};

export type ThreadContext = {
  threadId: string;
  subject: string;
  replyToAddress: string;
  replyToName: string;
  messageId: string; // the Message-ID header of the latest incoming email
  references: string;
  excerpt: string; // the last few messages as plain text, for the reply writer
};

// ---------- small pure helpers (unit tested) ----------

export function parseAddress(header: string | undefined | null): {
  name: string;
  address: string;
} {
  const h = (header ?? "").trim();
  const angle = h.match(/^(.*?)<([^>]+)>\s*$/);
  if (angle)
    return {
      name: angle[1].replace(/^["'\s]+|["'\s]+$/g, ""),
      address: angle[2].trim().toLowerCase(),
    };
  return { name: "", address: h.toLowerCase() };
}

// "Re: Re: Kitchen quote" -> "Kitchen quote"
export const plainSubject = (subject: string | undefined | null) =>
  (subject ?? "").replace(/^\s*((re|fwd?):\s*)+/i, "").trim() || "(no subject)";

export const withRe = (subject: string) =>
  /^re:/i.test(subject.trim())
    ? subject.trim()
    : `Re: ${subject.trim() || "(no subject)"}`;

// Gmail search text for "emails from this client".
export function searchQuery(
  client: { name: string; aliases?: string[] | null; email?: string | null },
  hint = "",
) {
  const who: string[] = [];
  if (client.email) who.push(`from:${client.email}`);
  else {
    const names = [client.name, ...(client.aliases ?? [])]
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);
    for (const n of [...new Set(names)].slice(0, 4))
      who.push(`from:"${n.replace(/"/g, "")}"`);
  }
  const words = hint
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  return `(${who.join(" OR ")}) newer_than:90d${words ? ` ${words}` : ""}`;
}

const decode = (data: string | undefined) =>
  data ? Buffer.from(data, "base64url").toString("utf8") : "";

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function findText(part: Part | undefined, mime: string): string {
  if (!part) return "";
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findText(p, mime);
    if (found) return found;
  }
  return "";
}

const stripHtml = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');

// The new words of an email, without the quoted conversation underneath.
export function newText(payload: Part | undefined, limit = 2000): string {
  const plain =
    findText(payload, "text/plain") ||
    stripHtml(findText(payload, "text/html"));
  const kept: string[] = [];
  for (const line of plain.replace(/\r/g, "").split("\n")) {
    if (
      /^On .{10,200} wrote:\s*$/.test(line.trim()) ||
      /^-{2,}\s*Original Message/i.test(line.trim()) ||
      line.trim().startsWith(">")
    )
      break;
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const encodeHeader = (s: string) =>
  /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;

// The raw email Gmail needs for a draft: threaded under the email being answered.
export function buildRaw(mail: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}) {
  // Some of these come from the other person's email. A line break in one could add a header of their choosing,
  // so every header value is squashed onto a single line.
  const oneLine = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
  const inReplyTo = mail.inReplyTo ? oneLine(mail.inReplyTo) : "";
  const lines = [
    `To: ${oneLine(mail.to)}`,
    `Subject: ${encodeHeader(oneLine(mail.subject))}`,
    ...(inReplyTo
      ? [
          `In-Reply-To: ${inReplyTo}`,
          `References: ${oneLine([mail.references, inReplyTo].filter(Boolean).join(" "))}`,
        ]
      : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    (b64(mail.body.replace(/\r?\n/g, "\r\n")).match(/.{1,76}/g) ?? []).join(
      "\r\n",
    ),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

// ---------- talking to Gmail ----------

export type GmailAccess =
  | { ok: true; accessToken: string; email: string | null }
  | { ok: false; reason: "not_connected" | "reconnect" | "error" };

export async function gmailAccess(
  supabase: SupabaseClient,
  businessId: string,
): Promise<GmailAccess> {
  const config = googleConfig();
  if (!config) return { ok: false, reason: "not_connected" };
  const { data } = await supabase
    .from("gmail_connections")
    .select("refresh_token_enc, google_email")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_connected" };
  let refreshToken: string;
  try {
    refreshToken = decryptToken(data.refresh_token_enc);
  } catch {
    return { ok: false, reason: "reconnect" };
  }
  const { accessToken, error } = await refreshAccessToken(config, refreshToken);
  if (!accessToken)
    return {
      ok: false,
      reason: error === "invalid_grant" ? "reconnect" : "error",
    };
  return {
    ok: true,
    accessToken,
    email: data.google_email?.toLowerCase() ?? null,
  };
}

async function gmail<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Gmail said ${res.status}`);
  return (await res.json()) as T;
}

type Message = {
  id: string;
  internalDate?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: Part & { headers?: { name: string; value: string }[] };
};
type Thread = { id: string; messages?: Message[] };

const header = (m: Message, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
    ?.value;

const isMine = (m: Message, myEmail: string | null) =>
  !!myEmail &&
  parseAddress(header(m, "From")).address === myEmail.toLowerCase();

// Up to five conversations where the client wrote to you, newest first.
export async function findCandidates(
  accessToken: string,
  q: string,
  myEmail: string | null,
): Promise<Candidate[]> {
  const found = await gmail<{ threads?: { id: string }[] }>(
    accessToken,
    `/threads?${new URLSearchParams({ q, maxResults: "8" })}`,
  );
  // The five conversations are looked at side by side, so this stays quick.
  const threads = await Promise.all(
    (found.threads ?? []).slice(0, 5).map(async (t) => ({
      id: t.id,
      thread: await gmail<Thread>(
        accessToken,
        `/threads/${encodeURIComponent(t.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      ),
    })),
  );
  const out: Candidate[] = [];
  for (const { id, thread } of threads) {
    const incoming = (thread.messages ?? []).filter((m) => !isMine(m, myEmail));
    const last = incoming[incoming.length - 1];
    if (!last) continue; // nothing from them in this conversation
    const from = parseAddress(header(last, "From"));
    out.push({
      threadId: id,
      fromName: from.name,
      fromAddress: from.address,
      subject: plainSubject(header(last, "Subject")),
      date: new Date(Number(last.internalDate ?? Date.now())).toISOString(),
      snippet: (last.snippet ?? "").slice(0, 160),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// Reads ONE conversation: who to reply to, the ids that thread the reply, and the recent words.
export async function readThread(
  accessToken: string,
  threadId: string,
  myEmail: string | null,
): Promise<ThreadContext | null> {
  const thread = await gmail<Thread>(
    accessToken,
    `/threads/${encodeURIComponent(threadId)}?format=full`,
  );
  const messages = thread.messages ?? [];
  const incoming = messages.filter((m) => !isMine(m, myEmail));
  const last = incoming[incoming.length - 1];
  if (!last) return null;
  const replyTo = parseAddress(
    header(last, "Reply-To") || header(last, "From"),
  );
  const excerpt = messages
    .slice(-3)
    .map(
      (m) =>
        `${isMine(m, myEmail) ? "YOU" : parseAddress(header(m, "From")).name || "THEM"} wrote:\n${newText(m.payload)}`,
    )
    .join("\n\n---\n\n");
  return {
    threadId,
    subject: plainSubject(header(last, "Subject")),
    replyToAddress: replyTo.address,
    replyToName: replyTo.name,
    messageId: header(last, "Message-ID") ?? header(last, "Message-Id") ?? "",
    references: header(last, "References") ?? "",
    excerpt,
  };
}

export async function createDraft(
  accessToken: string,
  mail: {
    threadId: string;
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  },
): Promise<{ draftId: string }> {
  const made = await gmail<{ id: string }>(accessToken, "/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: { threadId: mail.threadId, raw: buildRaw(mail) },
    }),
  });
  return { draftId: made.id };
}
