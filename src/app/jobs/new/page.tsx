import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import NewJobForm from "./new-job-form";

async function Form() {
  await requireBusiness();
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, address")
    .order("name");
  return <NewJobForm clients={clients ?? []} />;
}

export default function NewJobPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/jobs" className="flex h-12 items-center text-muted underline">
        ← Jobs
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">New job</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Form />
      </Suspense>
    </main>
  );
}
