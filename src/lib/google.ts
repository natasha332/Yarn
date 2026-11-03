// Talking to Google: the sign-in step and swapping codes for keys.
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET live in Netlify's environment settings, never in the code.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const REVOKE_URL = process.env.GOOGLE_REVOKE_URL ?? "https://oauth2.googleapis.com/revoke";

// Add and change events on her calendars. "openid email" only tells us which account was connected.
const SCOPES = "https://www.googleapis.com/auth/calendar.events openid email";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tokenKey = process.env.GOOGLE_TOKEN_KEY;
  if (!clientId || !clientSecret || !tokenKey || tokenKey.length < 32) return null;
  return { clientId, clientSecret };
}

// Must match, character for character, the address saved in Google Cloud.
export function redirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI ?? `${origin}/api/google/callback`;
}

export function authUrl(clientId: string, origin: string, state: string) {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    // "offline" + "consent" make Google hand back the long-lived key every time.
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

type TokenReply = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenReply> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = (await res.json().catch(() => ({}))) as TokenReply;
  if (!res.ok) return { error: body.error ?? `http_${res.status}` };
  return body;
}

export async function exchangeCode(
  config: { clientId: string; clientSecret: string },
  origin: string,
  code: string,
) {
  const reply = await tokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri(origin),
    grant_type: "authorization_code",
  });
  return {
    error: reply.error,
    refreshToken: reply.refresh_token,
    email: emailFromIdToken(reply.id_token),
  };
}

// Google sends the account's email inside the id_token it hands us directly over a secure
// connection, so reading it (without re-checking the signature) is safe here.
function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function revokeToken(refreshToken: string) {
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    // Best effort: the connection is removed from Yarn either way.
  }
}
