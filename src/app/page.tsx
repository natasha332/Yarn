import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function logOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function WhoAmI() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <p className="font-mono text-sm text-muted">Logged in as {user?.email}</p>
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
      <form action={logOut}>
        <button className="h-14 rounded-xl border border-line bg-surface px-8 text-lg font-semibold">
          Log out
        </button>
      </form>
    </main>
  );
}
