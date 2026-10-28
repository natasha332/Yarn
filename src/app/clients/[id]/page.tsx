import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../client-form";

async function EditClient({ params }: Pick<PageProps<"/clients/[id]">, "params">) {
  const { id } = await params;
  const business = await requireBusiness();
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, phone, email, address, aliases")
    .eq("id", id)
    .maybeSingle();

  // Not found, or it belongs to someone else (row-level security hides it).
  if (!client) notFound();

  return <ClientForm businessId={business.id} client={client} />;
}

export default function EditClientPage(props: PageProps<"/clients/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/clients" className="flex h-12 items-center text-muted underline">
        ← Clients
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">Edit client</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <EditClient params={props.params} />
      </Suspense>
    </main>
  );
}
