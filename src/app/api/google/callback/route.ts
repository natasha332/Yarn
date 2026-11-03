import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, googleConfig } from "@/lib/google";
import { getMyBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/token-crypto";

// Google sends you back here after you say yes (or no). We swap the one-time code for the
// long-lived key, scramble it, and save it against your business.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const finish = (why: string) => {
    const response = NextResponse.redirect(new URL(`/settings?google=${why}`, origin));
    response.cookies.delete({ name: "yarn_google_state", path: "/api/google" });
    return response;
  };

  if (params.get("error")) return finish("denied");

  const expected = request.cookies.get("yarn_google_state")?.value;
  const code = params.get("code");
  if (!expected || params.get("state") !== expected || !code) return finish("failed");

  const config = googleConfig();
  if (!config) return finish("notset");

  const business = await getMyBusiness();
  if (!business) return NextResponse.redirect(new URL("/login", origin));

  const { error, refreshToken, email } = await exchangeCode(config, origin, code);
  if (error || !refreshToken) return finish(error ? "failed" : "norefresh");

  const supabase = await createClient();
  const { error: saveError } = await supabase.from("google_connections").upsert({
    business_id: business.id,
    google_email: email,
    refresh_token_enc: encryptToken(refreshToken),
    connected_at: new Date().toISOString(),
  });
  return finish(saveError ? "failed" : "connected");
}
