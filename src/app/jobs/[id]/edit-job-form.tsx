"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOB_STATUSES } from "@/lib/jobs";

type JobRow = { id: string; name: string; address: string | null; status: string };

const inputClass =
  "h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal";

export default function EditJobForm({ job }: { job: JobRow }) {
  const router = useRouter();
  const [name, setName] = useState(job.name);
  const [address, setAddress] = useState(job.address ?? "");
  const [status, setStatus] = useState(job.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done() {
    router.push("/jobs");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("jobs")
      .update({ name: name.trim(), address: address.trim() || null, status })
      .eq("id", job.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    done();
  }

  async function onDelete() {
    if (!window.confirm(`Delete the job "${job.name}"? The client stays.`)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("jobs").delete().eq("id", job.id);
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
        Job name
        <input required maxLength={150} autoComplete="off" value={name}
          onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className={`${inputClass} px-3`}>
          {JOB_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Job address
        <input autoComplete="off" value={address}
          onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </label>

      {error && <p role="alert" className="text-variation">{error}</p>}

      <button type="submit" disabled={busy}
        className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50">
        {busy ? "One sec…" : "Save changes"}
      </button>
      <button type="button" onClick={onDelete} disabled={busy}
        className="h-14 rounded-xl border border-line bg-surface text-lg font-semibold text-variation disabled:opacity-50">
        Delete job
      </button>
    </form>
  );
}
