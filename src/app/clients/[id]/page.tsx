import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../client-form";

async function EditPerson({
  params,
}: Pick<PageProps<"/clients/[id]">, "params">) {
  const { id } = await params;
  const business = await requireBusiness();
  const supabase = await createClient();
  const [{ data: client }, { count: jobCount }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, phone, email, address, aliases, kind, role")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", id),
  ]);

  // Not found, or it belongs to someone else (row-level security hides it).
  if (!client) notFound();
  const contact = client.kind === "contact";

  return (
    <>
      <Link
        href={contact ? "/clients?kind=contact" : "/clients"}
        className="flex h-12 items-center text-muted underline"
      >
        ← Contacts
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">
        {contact ? "Edit business contact" : "Edit client"}
      </h1>
      <ClientForm
        businessId={business.id}
        client={client}
        hasJobs={!!jobCount}
      />
    </>
  );
}

export default function EditClientPage(props: PageProps<"/clients/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <EditPerson params={props.params} />
      </Suspense>
    </main>
  );
}
