import { NextResponse, type NextRequest } from "next/server";

// Yarn's own pages call these routes from the same address. A request that says it came from some OTHER
// website (an "Origin" that isn't ours) is refused. Normally the login cookie already stops those, so this
// is a second lock. Requests with no Origin at all (not from a browser page) are left to the normal login check.
export function crossSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

export const blocked = () =>
  NextResponse.json(
    { status: "error", error: "Blocked.", message: "Blocked." },
    { status: 403 },
  );
