import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business";
import LogOutButton from "./log-out-button";
import PendingNotes from "./pending-notes";
import Recorder from "./recorder";
import RecentNotes from "./recent-notes";

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
    <div className="text-center">
      <p className="text-lg font-semibold">{business.name}</p>
      <p className="font-mono text-xs text-muted">{user?.email}</p>
    </div>
  );
}

// The recorder needs to know whose business and login it is saving for.
async function RecorderGate() {
  const business = await getMyBusiness();
  if (!business) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <Recorder businessId={business.id} userId={user.id} />
      <PendingNotes userId={user.id} timezone={business.timezone} />
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-4">
      <h1 className="font-display text-5xl font-bold leading-none">
        yarn<span className="text-accent">.</span>
      </h1>

      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <div className="h-[min(68vw,18rem)] w-[min(68vw,18rem)] rounded-full bg-accent opacity-40" />
          </div>
        }
      >
        <RecorderGate />
      </Suspense>

      <Suspense fallback={null}>
        <RecentNotes />
      </Suspense>

      <nav className="flex flex-col gap-3">
        <Link
          href="/jobs"
          className="flex h-14 items-center justify-center rounded-xl border border-line bg-surface text-lg font-semibold"
        >
          Jobs
        </Link>
        <Link
          href="/clients"
          className="flex h-14 items-center justify-center rounded-xl border border-line bg-surface text-lg font-semibold"
        >
          Clients
        </Link>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-3 pt-4">
        <Suspense fallback={<p className="font-mono text-xs text-muted">…</p>}>
          <WhoAmI />
        </Suspense>
        <LogOutButton action={logOut} />
      </div>
    </main>
  );
}
