import { NextResponse, type NextRequest } from "next/server";
import { prepareReply } from "@/lib/gmail-reply";
import { createClient } from "@/lib/supabase/server";

// She picked which email ("Which email?"). Only one of the options saved on the card is accepted.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Please log in again." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  const threadId = typeof body?.threadId === "string" ? body.threadId : null;
  if (!itemId || !threadId) return NextResponse.json({ status: "error", message: "Missing card." }, { status: 400 });
  return NextResponse.json(await prepareReply(supabase, user, itemId, threadId));
}
