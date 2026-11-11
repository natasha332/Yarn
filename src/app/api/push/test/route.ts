import { NextResponse, type NextRequest } from "next/server";
import { pushKeys, sendPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { blocked, crossSite } from "@/lib/same-origin";

// "Send me a test notification": sends one to THIS phone only.
export async function POST(request: NextRequest) {
  if (crossSite(request)) return blocked();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Please log in again." }, { status: 401 });
  if (!pushKeys()) return NextResponse.json({ status: "notset", message: "Notifications aren't set up on the server yet." });

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return NextResponse.json({ status: "error", message: "Missing device." }, { status: 400 });

  const { data: device } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (!device) return NextResponse.json({ status: "error", message: "This phone isn't turned on yet. Tap Turn on first." }, { status: 404 });

  const outcome = await sendPush(device, {
    title: "Yarn",
    body: "Notifications are working on this phone ✓",
    url: "/settings",
    tag: "yarn-test",
  });
  if (outcome === "gone") {
    await supabase.from("push_subscriptions").delete().eq("id", device.id);
    return NextResponse.json({ status: "gone", message: "This phone's notifications were switched off. Turn them on again." });
  }
  return NextResponse.json(outcome === "ok" ? { status: "sent" } : { status: "error", message: "Couldn't send. Try again in a moment." });
}
