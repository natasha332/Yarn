import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDigests } from "@/lib/digest-run";
import { pushKeys, sendPush } from "@/lib/push";
import { sendEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";

// The timer calls this every 15 minutes (see netlify/functions/digest-cron.mts).
// It is not for people: it only answers someone who knows CRON_SECRET.

const sha = (s: string) => createHash("sha256").update(s).digest();

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !secret ||
    secret.length < 20 ||
    !timingSafeEqual(sha(given), sha(secret))
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY isn't set." },
      { status: 503 },
    );
  if (!process.env.RESEND_API_KEY)
    return NextResponse.json(
      { error: "RESEND_API_KEY isn't set." },
      { status: 503 },
    );

  try {
    const summary = await runDigests(admin, {
      now: new Date(),
      siteUrl: process.env.SITE_URL ?? request.nextUrl.origin,
      send: sendEmail,
      alert: process.env.ALERT_EMAIL
        ? async (subject, text) => {
            await sendEmail({
              to: process.env.ALERT_EMAIL!,
              subject,
              text,
              html: `<pre style="font-family:inherit;white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
            });
          }
        : undefined,
      push: pushKeys()
        ? {
            devices: async (businessId) => {
              const { data } = await admin
                .from("push_subscriptions")
                .select("id, endpoint, p256dh, auth")
                .eq("business_id", businessId);
              return data ?? [];
            },
            send: sendPush,
            forget: async (id) => {
              await admin.from("push_subscriptions").delete().eq("id", id);
            },
          }
        : undefined,
    });
    // The heartbeat: "the timer ran at this time". /api/health reads it. A failure to write it changes nothing else.
    try {
      await admin
        .from("system_status")
        .upsert({
          key: "digest_run",
          value: summary,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // not fatal
    }
    return NextResponse.json(summary);
  } catch (e) {
    console.error("Digest run failed:", e);
    return NextResponse.json({ error: "The run failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
