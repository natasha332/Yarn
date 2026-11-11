import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A address for a free monitoring service (like UptimeRobot) to check every few minutes:
//   https://<your address>/api/health?key=<HEALTH_TOKEN>
// 200 means the 15-minute timer ran recently. 503 means it hasn't (or the database can't be reached),
// and the monitoring service emails you. It shows nothing about anyone's data.

const sha = (s: string) => createHash("sha256").update(s).digest();
const STALE_AFTER_MINUTES = 40; // the timer runs every 15: this allows two misses before shouting

export async function GET(request: NextRequest) {
  const token = process.env.HEALTH_TOKEN;
  const given = request.nextUrl.searchParams.get("key") ?? "";
  if (!token || token.length < 20 || !timingSafeEqual(sha(given), sha(token))) {
    return NextResponse.json(
      { ok: false, reason: "Not allowed." },
      { status: 401 },
    );
  }
  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { ok: false, reason: "SUPABASE_SECRET_KEY isn't set." },
      { status: 503 },
    );

  const { data, error } = await admin
    .from("system_status")
    .select("updated_at")
    .eq("key", "digest_run")
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { ok: false, reason: "Can't read the database." },
      { status: 503 },
    );
  if (!data)
    return NextResponse.json(
      { ok: false, reason: "The timer hasn't run yet." },
      { status: 503 },
    );

  const minutes = Math.round(
    (Date.now() - new Date(data.updated_at).getTime()) / 60000,
  );
  const ok = minutes <= STALE_AFTER_MINUTES;
  return NextResponse.json(
    {
      ok,
      minutesSinceLastRun: minutes,
      ...(ok ? {} : { reason: `The timer last ran ${minutes} minutes ago.` }),
    },
    { status: ok ? 200 : 503 },
  );
}
