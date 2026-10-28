"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOB_STATUSES } from "@/lib/jobs";

type ClientOption = { id: string; name: string; address: string | null };

const inputClass =
  "h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal";
const labelClass = "flex flex-col gap-1 font-semibold";

export default function NewJobForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();

  // Most clients only ever have one job, so "new client" is the default.
  const [repeat, setRepeat] = useState(false);
  const [existingId, setExistingId] = useState("");

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [aliases, setAliases] = useState("");

  const [jobName, setJobName] = useState("");
  const [status, setStatus] = useState("consultation");
  const [sameAddress, setSameAddress] = useState(true);
  const [jobAddressOwn, setJobAddressOwn] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = clients.find((c) => c.id === existingId);
  const clientAddressNow = repeat ? (existing?.address ?? "") : clientAddress;
  const jobAddress = sameAddress ? clientAddressNow : jobAddressOwn;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (repeat && !existingId) {
      setError("Pick the client first.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("create_job", {
      job_name: jobName,
      job_status: status,
      job_address: jobAddress.trim() || null,
      existing_client_id: repeat ? existingId : null,
      client_name: repeat ? null : clientName,
      client_phone: repeat ? null : phone,
      client_email: repeat ? null : email,
      client_address: repeat ? null : clientAddress,
      client_aliases: repeat
        ? []
        : aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/jobs");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-3xl font-bold leading-none">Client</h2>

        {clients.length > 0 && (
          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
              className="h-6 w-6 accent-[var(--accent)]"
            />
            <span className="font-semibold">Repeat client</span>
          </label>
        )}

        {repeat ? (
          <label className={labelClass}>
            Which client?
            <select
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              className={`${inputClass} px-3`}
            >
              <option value="">Choose…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className={labelClass}>
              Name
              <input required maxLength={100} autoComplete="off" value={clientName}
                onChange={(e) => setClientName(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Phone
              <input type="tel" autoComplete="off" value={phone}
                onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Email
              <input type="email" autoComplete="off" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Address
              <input autoComplete="off" value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Nicknames
              <input autoComplete="off" value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="e.g. Robyn, Rob, Mrs Clarke" className={inputClass} />
              <span className="text-sm font-normal text-muted">
                Other names you might say out loud. Separate with commas.
              </span>
            </label>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-3xl font-bold leading-none">Job</h2>
        <label className={labelClass}>
          Job name
          <input required maxLength={150} autoComplete="off" value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g. Kitchen renovation" className={inputClass} />
        </label>
        <label className={labelClass}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className={`${inputClass} px-3`}>
            {JOB_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            checked={sameAddress}
            onChange={(e) => setSameAddress(e.target.checked)}
            className="h-6 w-6 accent-[var(--accent)]"
          />
          <span className="font-semibold">Job is at the client&apos;s address</span>
        </label>
        {sameAddress ? (
          clientAddressNow && <p className="-mt-2 text-muted">{clientAddressNow}</p>
        ) : (
          <label className={labelClass}>
            Job address
            <input autoComplete="off" value={jobAddressOwn}
              onChange={(e) => setJobAddressOwn(e.target.value)} className={inputClass} />
          </label>
        )}
      </section>

      {error && <p role="alert" className="text-variation">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
      >
        {busy ? "One sec…" : "Save job"}
      </button>
    </form>
  );
}
