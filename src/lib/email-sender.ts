import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultSignOff } from "@/lib/client-email";

// How emails to clients should look, for the logged-in person's business:
// the name clients see, where their replies go, and how the email is signed.

export type Sender = {
  businessName: string;
  fromName: string;
  replyTo: string | null;
  signOff: string;
  copyToMe: boolean; // also send each client email to the reply-to address
};

export async function loadSender(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<Sender | null> {
  const [{ data: business }, { data: person }] = await Promise.all([
    // "*" so this still works if a newer column hasn't been added to the database yet
    supabase.from("businesses").select("*").maybeSingle(),
    supabase.from("users").select("name").eq("id", user.id).maybeSingle(),
  ]);
  if (!business) return null;
  return {
    businessName: business.name,
    fromName: business.email_from_name?.trim() || business.name,
    replyTo: business.email_reply_to?.trim() || user.email || null,
    signOff: business.email_sign_off?.trim() || defaultSignOff(person?.name ?? null, business.name),
    copyToMe: business.email_copy_to_me !== false,
  };
}
