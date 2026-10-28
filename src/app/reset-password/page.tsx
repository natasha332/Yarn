"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

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
          Choose a new password
        </h1>
        <p className="mt-2 text-lg text-muted">At least 8 characters.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 font-semibold">
          New password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Type it again
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal"
          />
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
          {busy ? "One sec…" : "Save new password"}
        </button>
      </form>
    </main>
  );
}
