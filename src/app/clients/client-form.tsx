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
};

const inputClass =
  "h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal";

export default function ClientForm({
  businessId,
  client,
}: {
  businessId: string;
  client?: ClientRow;
}) {
  const router = useRouter();
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [aliases, setAliases] = useState((client?.aliases ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done() {
    router.push("/clients");
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
      address: address.trim() || null,
      aliases: aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    };

    const supabase = createClient();
    const { error } = client
      ? await supabase.from("clients").update(values).eq("id", client.id)
      : await supabase.from("clients").insert({ ...values, business_id: businessId });

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
      `Delete ${client.name}? Their jobs stay, but won't be linked to anyone.`,
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    done();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
      <label className="flex flex-col gap-1 font-semibold">
        Address
        <input
          autoComplete="off"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Nicknames
        <input
          autoComplete="off"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="e.g. Robyn, Rob, Mrs Clarke"
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
        {busy ? "One sec…" : client ? "Save changes" : "Add client"}
      </button>

      {client && (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="h-14 rounded-xl border border-line bg-surface text-lg font-semibold text-variation disabled:opacity-50"
        >
          Delete client
        </button>
      )}
    </form>
  );
}
