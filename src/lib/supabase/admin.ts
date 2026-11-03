import { createClient } from "@supabase/supabase-js";

// A connection that is NOT tied to anyone logging in. Only for the automatic emails, which have
// to look at every business. SUPABASE_SECRET_KEY is very powerful: it lives only in Netlify's
// environment settings and must never be sent to the browser or put in the code.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
