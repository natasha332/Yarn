// The timer. Netlify wakes this every 15 minutes; it just nudges Yarn's own "send what's due" route.
// All the real work (who is due, who already got theirs) happens there.

export default async () => {
  const site = process.env.SITE_URL ?? process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) {
    console.error("digest-cron: SITE_URL (or URL) and CRON_SECRET must be set.");
    return;
  }
  const res = await fetch(`${site.replace(/\/$/, "")}/api/cron/digest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.log("digest-cron:", res.status, await res.text());
};

export const config = { schedule: "*/15 * * * *" };
