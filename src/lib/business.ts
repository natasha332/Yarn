import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The business the logged-in person belongs to, or null if they haven't set one up yet.
// Row-level security means this can only ever return their own business.
export async function getMyBusiness() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, name, timezone")
    .maybeSingle();
  return data;
}

// Same as getMyBusiness, but sends people who haven't set up yet to onboarding.
export async function requireBusiness() {
  const business = await getMyBusiness();
  if (!business) redirect("/onboarding");
  return business;
}
