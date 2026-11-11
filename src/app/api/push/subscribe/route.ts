import { NextResponse, type NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/business";
import { parseSubscription } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { blocked, crossSite } from "@/lib/same-origin";

// "Turn on notifications on this phone": saves the phone's push address for the logged-in person.
export async function POST(request: NextRequest) {
  if (crossSite(request)) return blocked();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Please log in again." }, { status: 401 });
  const business = await getMyBusiness();
  if (!business) return NextResponse.json({ status: "error", message: "Finish setting up your business first." }, { status: 409 });

  const body = await request.json().catch(() => null);
  const sub = parseSubscription(body?.subscription);
  if (!sub) return NextResponse.json({ status: "error", message: "That doesn't look like a real notification address." }, { status: 400 });
  const device = typeof body?.device === "string" ? body.device.slice(0, 80) : null;

  // The same phone turning it on again replaces its old row (its codes may have changed).
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ business_id: business.id, user_id: user.id, device, ...sub });
  if (error) {
    // The only usual cause: this phone is already signed up under someone else's login.
    return NextResponse.json({ status: "error", message: "Couldn't turn notifications on for this phone. Log out of other Yarn accounts on it and try again." }, { status: 409 });
  }
  return NextResponse.json({ status: "saved" });
}
