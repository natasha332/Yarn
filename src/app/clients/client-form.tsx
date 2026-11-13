"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  aliases: string[];
  kind: "client" | "contact";
  role: string | null;
};

const inputClass =
  "h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal";

export default function ClientForm({
  businessId,
  client,
  initialKind = "client",
  hasJobs = false,
}: {
  businessId: string;
  client?: ClientRow;
  initialKind?: "client" | "contact";
  hasJobs?: boolean; // a client with jobs stays a client
}) {
  const router = useRouter();
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [aliases, setAliases] = useState((client?.aliases ?? []).join(", "));
  const [kind, setKind] = useState<"client" | "contact">(
    client?.kind ?? initialKind,
  );
  const [role, setRole] = useState(client?.role ?? "");
  const contact = kind === "contact";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done() {
    router.push(contact ? "/clients?kind=contact" : "/clients");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const values = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      // Business contacts don't get an address or a role-less label: keep whatever was there.
      ...(contact ? {} : { address: address.trim() || null }),
      kind,
      role: contact ? role.trim().slice(0, 60) || null : null,
      aliases: aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    };

    const supabase = createClient();
    const { error } = client
      ? await supabase.from("clients").update(values).eq("id", client.id)
      : await supabase
          .from("clients")
          .insert({ ...values, business_id: businessId });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    done();
  }

  async function onDelete() {
    if (!client) return;
    const ok = window.confirm(
      contact
        ? `Delete ${client.name}?`
        : `Delete ${client.name}? Their jobs stay, but won't be linked to anyone.`,
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    done();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {hasJobs ? (
        <p className="text-sm text-muted">
          This client has jobs, so they stay a client.
        </p>
      ) : (
        <div
          role="group"
          aria-label="Client or business contact"
          className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-sunk p-1"
        >
          {(
            [
              ["client", "Client"],
              ["contact", "Business contact"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={`h-11 rounded-lg font-semibold ${
                kind === value ? "bg-surface text-ink shadow-sm" : "text-muted"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <label className="flex flex-col gap-1 font-semibold">
        Name
        <input
          required
          maxLength={100}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      {contact && (
        <label className="flex flex-col gap-1 font-semibold">
          Role
          <input
            maxLength={60}
            autoComplete="off"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Accountant, Timber supplier, Sales rep"
            className={inputClass}
          />
          <span className="text-sm font-normal text-muted">
            What they are to you. Shown next to their name.
          </span>
        </label>
      )}
      <label className="flex flex-col gap-1 font-semibold">
        Phone
        <input
          type="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Email
        <input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      {!contact && (
        <label className="flex flex-col gap-1 font-semibold">
          Address
          <input
            autoComplete="off"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 font-semibold">
        Nicknames
        <input
          autoComplete="off"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder={
            contact ? "e.g. my accountant, Sam" : "e.g. Robyn, Rob, Mrs Clarke"
          }
          className={inputClass}
        />
        <span className="text-sm font-normal text-muted">
          Other names you might say out loud. Separate with commas.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-variation">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
      >
        {busy
          ? "One sec…"
          : client
            ? "Save changes"
            : contact
              ? "Add business contact"
              : "Add client"}
      </button>

      {client && (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="h-14 rounded-xl border border-line bg-surface text-lg font-semibold text-variation disabled:opacity-50"
        >
          {contact ? "Delete business contact" : "Delete client"}
        </button>
      )}
    </form>
  );
}
