import webpush from "web-push";
import { senderAddress } from "@/lib/resend";

// Sending a notification to a phone's push service. The two VAPID keys prove the message comes from Yarn:
// VAPID_PUBLIC_KEY (not secret, the phone is given it) and VAPID_PRIVATE_KEY (secret: Netlify only).
// Each message is scrambled for one device, so the push service (Google, Apple) can't read it.

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushOutcome = "ok" | "gone" | "error";

export const pushKeys = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  return publicKey && privateKey ? { publicKey, privateKey } : null;
};

export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushOutcome> {
  const keys = pushKeys();
  if (!keys) return "error";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT ?? `mailto:${senderAddress()}`,
          publicKey: keys.publicKey,
          privateKey: keys.privateKey,
        },
        TTL: 4 * 3600, // a briefing that can't be delivered within 4 hours is no longer useful
        timeout: 8000,
      },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404 / 410: the phone has removed the subscription. Forget it.
    if (status === 404 || status === 410) return "gone";
    console.error("push failed:", status ?? (e instanceof Error ? e.message : e));
    return "error";
  }
}

// Only accepts what a real browser would send, so nothing odd gets saved or called later.
export function parseSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const s = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 1000) return null;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  const b64url = /^[A-Za-z0-9_-]+$/;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !b64url.test(p256dh) || !b64url.test(auth)) return null;
  if (Buffer.from(p256dh, "base64url").length !== 65 || Buffer.from(auth, "base64url").length < 16) return null;
  return { endpoint: s.endpoint, p256dh, auth };
}
