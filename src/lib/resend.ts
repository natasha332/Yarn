// Sending email through Resend (resend.com). The key lives in Netlify's environment settings.
const API = process.env.RESEND_API_URL ?? "https://api.resend.com";

// While testing, Resend only lets the free sender email the address the Resend account was made with.
const DEFAULT_FROM = "Yarn <onboarding@resend.dev>";

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "notset" | "rejected" | "error"; message: string };

// "Yarn <briefing@mail.example.com>" -> "briefing@mail.example.com"
export function senderAddress() {
  const raw = process.env.EMAIL_FROM || DEFAULT_FROM;
  return raw.match(/<([^>]+)>/)?.[1] ?? raw;
}

export async function sendEmail(mail: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string; // the name people see, on the same sending address
  replyTo?: string | null; // where their replies go
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "notset", message: "Email isn't set up on the server yet." };

  try {
    const res = await fetch(`${API}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: mail.fromName
          ? `${mail.fromName.replace(/["<>\r\n]/g, "").trim()} <${senderAddress()}>`
          : process.env.EMAIL_FROM || DEFAULT_FROM,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok) return { ok: true, id: body.id ?? null };
    console.error("Resend:", res.status, body.message);
    return {
      ok: false,
      reason: res.status === 401 || res.status === 403 || res.status === 422 ? "rejected" : "error",
      message: body.message ?? `Resend said ${res.status}.`,
    };
  } catch {
    return { ok: false, reason: "error", message: "Couldn't reach Resend just now." };
  }
}
