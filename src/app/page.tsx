import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business";

async function logOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function WhoAmI() {
  const business = await getMyBusiness();
  // First time here? Go and set up the business.
  if (!business) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <p className="text-xl font-semibold">{business.name}</p>
      <p className="font-mono text-sm text-muted">Logged in as {user?.email}</p>
    </>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="font-display text-6xl font-bold leading-none">
        yarn<span className="text-accent">.</span>
      </h1>
      <p className="text-lg text-muted">Talk, don&apos;t type.</p>
      <Suspense fallback={<p className="font-mono text-sm text-muted">…</p>}>
        <WhoAmI />
      </Suspense>
      <Link
        href="/capture"
        className="grid h-28 w-28 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-ink shadow-[0_0_0_10px_color-mix(in_srgb,var(--accent)_16%,transparent)]"
      >
        Talk
      </Link>
      <Link
        href="/jobs"
        className="flex h-14 w-full max-w-xs items-center justify-center rounded-xl border border-line bg-surface text-lg font-semibold"
      >
        Jobs
      </Link>
      <Link
        href="/clients"
        className="flex h-14 w-full max-w-xs items-center justify-center rounded-xl border border-line bg-surface text-lg font-semibold"
      >
        Clients
      </Link>
      <form action={logOut}>
        <button className="h-14 rounded-xl border border-line bg-surface px-8 text-lg font-semibold">
          Log out
        </button>
      </form>
    </main>
  );
}
