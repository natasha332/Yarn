import { NextResponse, type NextRequest } from "next/server";
import { prepareReply } from "@/lib/gmail-reply";
import { createClient } from "@/lib/supabase/server";
import { blocked, crossSite } from "@/lib/same-origin";

// Called by the card itself the moment a "reply to ..." card appears: finds the email and writes the reply.
export async function POST(request: NextRequest) {
  if (crossSite(request)) return blocked();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Please log in again." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) return NextResponse.json({ status: "error", message: "Missing card." }, { status: 400 });
  return NextResponse.json(await prepareReply(supabase, user, itemId));
}
