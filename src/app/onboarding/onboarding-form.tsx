"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TIMEZONES = [
  { value: "Australia/Sydney", label: "Sydney, Canberra, Newcastle (NSW, ACT)" },
  { value: "Australia/Melbourne", label: "Melbourne (VIC)" },
  { value: "Australia/Brisbane", label: "Brisbane (QLD)" },
  { value: "Australia/Adelaide", label: "Adelaide (SA)" },
  { value: "Australia/Perth", label: "Perth (WA)" },
  { value: "Australia/Hobart", label: "Hobart (TAS)" },
  { value: "Australia/Darwin", label: "Darwin (NT)" },
];

export default function OnboardingForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [timezone, setTimezone] = useState("Australia/Sydney");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("create_business", {
      business_name: businessName,
      owner_name: ownerName,
      business_timezone: timezone,
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="font-display text-5xl font-bold leading-none">
          Hello. Let&apos;s set you up.
        </h1>
        <p className="mt-2 text-lg text-muted">Takes 20 seconds.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 font-semibold">
          Business name
          <input
            required
            maxLength={100}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Fresh Joinery"
            className="h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Your name
          <input
            required
            maxLength={100}
            autoComplete="name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Where are you based?
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-14 rounded-xl border border-line bg-surface px-3 text-lg font-normal"
          >
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
          {busy ? "One sec…" : "Let's go"}
        </button>
      </form>
    </main>
  );
}
