import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDigest } from "@/lib/digest";
import { renderDigest } from "@/lib/digest-email";
import { dueDigests, type BusinessSchedule } from "@/lib/digest-schedule";
import type { SendResult } from "@/lib/resend";

// One pass of the timer: look at every business, send whatever is due, log it.
// Safe to run as often as you like: the claim in digest_log means nobody gets the same email twice.

export type RunSummary = { checked: number; sent: number; alreadyHandled: number; skipped: number; failed: number };

type Business = BusinessSchedule & { id: string; name: string };
type Send = (mail: { to: string; subject: string; html: string; text: string }) => Promise<SendResult>;

export async function runDigests(
  admin: SupabaseClient,
  opts: { now: Date; siteUrl: string; send: Send },
): Promise<RunSummary> {
  const summary: RunSummary = { checked: 0, sent: 0, alreadyHandled: 0, skipped: 0, failed: 0 };

  const { data: businesses, error } = await admin
    .from("businesses")
    .select("id, name, timezone, morning_enabled, morning_email_time, wrapup_mode, wrapup_time, notify_channel");
  if (error) throw new Error(`Couldn't read businesses: ${error.message}`);

  for (const business of (businesses ?? []) as Business[]) {
    summary.checked++;
    for (const due of dueDigests(business, opts.now)) {
      const where = { business_id: business.id, kind: due.kind, local_date: due.localDate };
      try {
        const { data: claimed, error: claimError } = await admin.rpc("claim_digest", {
          p_business_id: business.id,
          p_kind: due.kind,
          p_local_date: due.localDate,
        });
        if (claimError) throw new Error(claimError.message);
        if (!claimed) {
          summary.alreadyHandled++;
          continue;
        }

        // The Google account her calendar is connected to, or her login email.
        const [{ data: google }, { data: owner }] = await Promise.all([
          admin.from("google_connections").select("google_email").eq("business_id", business.id).maybeSingle(),
          admin.from("users").select("email").eq("business_id", business.id).limit(1).maybeSingle(),
        ]);
        const to = google?.google_email ?? owner?.email ?? null;
        if (!to) {
          await admin.from("digest_log").update({ status: "skipped", error: "No email address" }).match(where);
          summary.skipped++;
          continue;
        }

        const digest = await loadDigest(admin, business, opts.now);
        const mail = renderDigest(due.kind, digest, { businessName: business.name, siteUrl: opts.siteUrl });
        const result = await opts.send({ to, ...mail });
        if (result.ok) {
          await admin
            .from("digest_log")
            .update({ status: "sent", to_email: to, sent_at: new Date().toISOString(), error: null })
            .match(where);
          summary.sent++;
        } else {
          await admin.from("digest_log").update({ status: "failed", to_email: to, error: result.message }).match(where);
          summary.failed++;
        }
      } catch (e) {
        console.error("Digest failed:", business.id, due.kind, e);
        await admin
          .from("digest_log")
          .update({ status: "failed", error: e instanceof Error ? e.message.slice(0, 300) : "Unknown error" })
          .match(where);
        summary.failed++;
      }
    }
  }
  return summary;
}
