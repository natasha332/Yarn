import Link from "next/link";
import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import ClientForm from "../client-form";

async function NewPerson({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const contact = kind === "contact";
  const business = await requireBusiness();
  return (
    <>
      <Link
        href={contact ? "/clients?kind=contact" : "/clients"}
        className="flex h-12 items-center text-muted underline"
      >
        ← Contacts
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">
        {contact ? "New business contact" : "New client"}
      </h1>
      <ClientForm
        businessId={business.id}
        initialKind={contact ? "contact" : "client"}
      />
    </>
  );
}

export default function NewClientPage(props: PageProps<"/clients/new">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewPerson
          searchParams={props.searchParams as Promise<{ kind?: string }>}
        />
      </Suspense>
    </main>
  );
}
