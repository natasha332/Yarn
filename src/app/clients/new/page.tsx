import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import ClientForm from "../client-form";

async function NewClient() {
  const business = await requireBusiness();
  return <ClientForm businessId={business.id} />;
}

export default function NewClientPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/clients" className="flex h-12 items-center text-muted underline">
        ← Clients
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">New client</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewClient />
      </Suspense>
    </main>
  );
}
