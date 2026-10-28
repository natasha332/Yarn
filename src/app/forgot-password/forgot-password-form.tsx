"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="font-display text-5xl font-bold leading-none">
          Forgot your password?
        </h1>
        <p className="mt-2 text-lg text-muted">
          No worries. We&apos;ll email you a link to choose a new one.
        </p>
      </div>

      {expired && !sent && (
        <p role="alert" className="text-variation">
          That link has expired or was already used. Enter your email and we&apos;ll
          send a fresh one.
        </p>
      )}

      {sent ? (
        <p className="text-invoice">
          If there&apos;s an account for that email, a reset link is on its way. Check
          your inbox (and junk folder).
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 font-semibold">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {busy ? "One sec…" : "Send me a link"}
          </button>
        </form>
      )}

      <Link href="/login" className="flex h-12 items-center justify-center text-muted underline">
        Back to log in
      </Link>
    </main>
  );
}
