import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { blocked, crossSite } from "@/lib/same-origin";

// "Turn off notifications on this phone".
export async function POST(request: NextRequest) {
  if (crossSite(request)) return blocked();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Please log in again." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return NextResponse.json({ status: "error", message: "Missing device." }, { status: 400 });
  // Row-level security means this can only remove devices in her own business.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ status: "removed" });
}
