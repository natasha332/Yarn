import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, googleConfig } from "@/lib/google";
import { getMyBusiness } from "@/lib/business";

// "Connect Google Calendar" sends you here, and from here to Google's own sign-in page.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (why: string) => NextResponse.redirect(new URL(`/settings?google=${why}`, origin));

  const config = googleConfig();
  if (!config) return back("notset");
  if (!(await getMyBusiness())) return NextResponse.redirect(new URL("/login", origin));

  // A one-off secret so only a sign-in that STARTED here can finish here.
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(authUrl(config.clientId, origin, state));
  response.cookies.set("yarn_google_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/google",
  });
  return response;
}
