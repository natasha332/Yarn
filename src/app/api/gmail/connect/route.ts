import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, GMAIL_SCOPES, googleConfig } from "@/lib/google";
import { getMyBusiness } from "@/lib/business";

// "Connect Gmail" sends you here, and from here to Google's own sign-in page.
// It shares Google's callback with Calendar: the "gmail." start of the secret tells the callback which one this is.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (why: string) => NextResponse.redirect(new URL(`/settings?gmail=${why}`, origin));

  const config = googleConfig();
  if (!config) return back("notset");
  if (!(await getMyBusiness())) return NextResponse.redirect(new URL("/login", origin));

  const state = `gmail.${randomBytes(24).toString("base64url")}`;
  const response = NextResponse.redirect(authUrl(config.clientId, origin, state, GMAIL_SCOPES));
  response.cookies.set("yarn_google_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/google",
  });
  return response;
}
