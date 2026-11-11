import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDigest } from "@/lib/digest";
import { renderDigest } from "@/lib/digest-email";
import { pushSummary } from "@/lib/push-summary";
import type { PushOutcome, PushPayload, PushTarget } from "@/lib/push";
import { dueDigests, type BusinessSchedule } from "@/lib/digest-schedule";
import type { SendResult } from "@/lib/resend";

// One pass of the timer: look at every business, send whatever is due, log it.
// Safe to run as often as you like: the claim in digest_log means nobody gets the same email twice.

export type RunSummary = {
  checked: number;
  sent: number;
  alreadyHandled: number;
  skipped: number;
  failed: number;
  pushed: number;
};

// How notifications reach phones. Left out when push isn't set up, and email then does the whole job.
export type PushDelivery = {
  devices: (businessId: string) => Promise<PushTarget[]>;
  send: (device: PushTarget, payload: PushPayload) => Promise<PushOutcome>;
  forget: (deviceId: string) => Promise<void>;
};

type Business = BusinessSchedule & { id: string; name: string };
type Send = (mail: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => Promise<SendResult>;

export async function runDigests(
  admin: SupabaseClient,
  opts: {
    now: Date;
    siteUrl: string;
    send: Send;
    push?: PushDelivery;
    alert?: (subject: string, text: string) => Promise<void>;
  },
): Promise<RunSummary> {
  const summary: RunSummary = {
    checked: 0,
    sent: 0,
    alreadyHandled: 0,
    skipped: 0,
    failed: 0,
    pushed: 0,
  };

  // After the third failed try (the last one it gets), tell the person who looks after Yarn. Once only.
  const alertIfGivenUp = async (
    business: { id: string; name: string },
    where: { business_id: string; kind: string; local_date: string },
    what: string,
  ) => {
    if (!opts.alert) return;
    try {
      const { data: row } = await admin
        .from("digest_log")
        .select("attempts")
        .match(where)
        .maybeSingle();
      if ((row?.attempts ?? 0) < 3) return;
      await opts.alert(
        `Yarn: ${business.name}'s ${where.kind === "morning" ? "morning briefing" : "day wrap-up"} failed 3 times`,
        `The ${where.kind === "morning" ? "morning briefing" : "day wrap-up"} for ${business.name} on ${where.local_date} failed 3 times, so Yarn has stopped trying for today.\n\nWhat went wrong: ${what}\n\nCheck Netlify (Functions, digest-cron) and Resend. Nothing else needs doing: tomorrow's one will be tried as normal.`,
      );
    } catch (e) {
      console.error(
        "Couldn't send the alert:",
        e instanceof Error ? e.message : e,
      );
    }
  };

  const { data: businesses, error } = await admin
    .from("businesses")
    .select(
      "id, name, timezone, morning_enabled, morning_email_time, wrapup_mode, wrapup_time, notify_channel",
    );
  if (error) throw new Error(`Couldn't read businesses: ${error.message}`);

  for (const business of (businesses ?? []) as Business[]) {
    summary.checked++;
    for (const due of dueDigests(business, opts.now)) {
      const where = {
        business_id: business.id,
        kind: due.kind,
        local_date: due.localDate,
      };
      try {
        const { data: claimed, error: claimError } = await admin.rpc(
          "claim_digest",
          {
            p_business_id: business.id,
            p_kind: due.kind,
            p_local_date: due.localDate,
          },
        );
        if (claimError) throw new Error(claimError.message);
        if (!claimed) {
          summary.alreadyHandled++;
          continue;
        }

        // The Google account her calendar is connected to, or her login email.
        const [{ data: google }, { data: owner }] = await Promise.all([
          admin
            .from("google_connections")
            .select("google_email")
            .eq("business_id", business.id)
            .maybeSingle(),
          admin
            .from("users")
            .select("email")
            .eq("business_id", business.id)
            .limit(1)
            .maybeSingle(),
        ]);
        const to = google?.google_email ?? owner?.email ?? null;

        const emailAsked = business.notify_channel !== "push";
        const pushAsked = business.notify_channel !== "email" && !!opts.push;
        const devices = pushAsked ? await opts.push!.devices(business.id) : [];
        if (!to && devices.length === 0) {
          await admin
            .from("digest_log")
            .update({
              status: "skipped",
              error: "No email address and no devices",
            })
            .match(where);
          summary.skipped++;
          continue;
        }

        const digest = await loadDigest(admin, business, opts.now);
        const via: string[] = [];
        const problems: string[] = [];

        // Push first: to every phone that has notifications on.
        if (pushAsked) {
          const message = pushSummary(due.kind, digest);
          let reached = 0;
          for (const device of devices) {
            const outcome = await opts.push!.send(device, message);
            if (outcome === "ok") reached++;
            else if (outcome === "gone") await opts.push!.forget(device.id);
          }
          if (reached) {
            via.push("push");
            summary.pushed += reached;
          } else
            problems.push(
              devices.length
                ? "push didn't reach any phone"
                : "no phones have notifications on",
            );
        }

        // Email: if she wants it, and also as the backup whenever nothing else got through.
        if (emailAsked || via.length === 0) {
          if (to) {
            const mail = renderDigest(due.kind, digest, {
              businessName: business.name,
              siteUrl: opts.siteUrl,
            });
            const result = await opts.send({ to, ...mail });
            if (result.ok) via.push(emailAsked ? "email" : "email (backup)");
            else problems.push(`email failed: ${result.message}`);
          } else problems.push("no email address");
        }

        if (via.length) {
          await admin
            .from("digest_log")
            .update({
              status: "sent",
              to_email: to,
              sent_at: new Date().toISOString(),
              error: problems.join("; ") || null,
            })
            .match(where);
          // Best effort: it only works once the newest database update has been run.
          await admin
            .from("digest_log")
            .update({ channels: via.join("+") })
            .match(where);
          summary.sent++;
        } else {
          await admin
            .from("digest_log")
            .update({
              status: "failed",
              to_email: to,
              error: problems.join("; ").slice(0, 300),
            })
            .match(where);
          summary.failed++;
          await alertIfGivenUp(
            business,
            where,
            problems.join("; ") || "unknown",
          );
        }
      } catch (e) {
        console.error("Digest failed:", business.id, due.kind, e);
        await admin
          .from("digest_log")
          .update({
            status: "failed",
            error:
              e instanceof Error ? e.message.slice(0, 300) : "Unknown error",
          })
          .match(where);
        summary.failed++;
        await alertIfGivenUp(
          business,
          where,
          e instanceof Error ? e.message.slice(0, 200) : "unknown error",
        );
      }
    }
  }
  return summary;
}
