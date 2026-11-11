import { NextResponse, type NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/business";
import { loadDigest } from "@/lib/digest";
import { renderDigest, type DigestKind } from "@/lib/digest-email";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import { blocked, crossSite } from "@/lib/same-origin";

// "Send me a test" on the Settings page: sends the real briefing or wrap-up, as it looks right now,
// to the same address the daily emails will go to. Nothing is logged, so it never blocks a real one.
export async function POST(request: NextRequest) {
  if (crossSite(request)) return blocked();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Please log in again." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const kind: DigestKind | null = body?.kind === "morning" || body?.kind === "wrapup" ? body.kind : null;
  if (!kind) return NextResponse.json({ status: "error", message: "Missing kind." }, { status: 400 });

  const business = await getMyBusiness();
  if (!business) return NextResponse.json({ status: "error", message: "Set up your business first." }, { status: 400 });

  // The Google account her calendar is connected to, or her login email.
  const { data: google } = await supabase.from("google_connections").select("google_email").maybeSingle();
  const to = google?.google_email ?? user.email;
  if (!to) return NextResponse.json({ status: "error", message: "No email address to send to." }, { status: 400 });

  const digest = await loadDigest(supabase, business);
  const mail = renderDigest(kind, digest, {
    businessName: business.name,
    siteUrl: process.env.SITE_URL ?? request.nextUrl.origin,
  });
  const result = await sendEmail({ to, ...mail });
  if (!result.ok) return NextResponse.json({ status: result.reason, message: result.message });
  return NextResponse.json({ status: "sent", to });
}
