"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.replace("/");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      // Supabase hides "already registered" to protect privacy: it returns a user
      // with no identities (or an explicit error, depending on settings).
      const alreadyHasAccount =
        error?.message.toLowerCase().includes("already registered") ||
        (data.user && data.user.identities?.length === 0);

      if (alreadyHasAccount) {
        setMode("signin");
        setMessage("Looks like you already have an account. Log in with your password.");
      } else if (error) {
        setError(error.message);
      } else if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setMessage("Check your email and tap the link to finish signing up.");
      }
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold leading-none">
          yarn<span className="text-accent">.</span>
        </h1>
        <p className="mt-2 text-lg text-muted">Talk, don&apos;t type.</p>
      </div>

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
        <label className="flex flex-col gap-1 font-semibold">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-xl border border-line bg-surface px-4 text-lg font-normal"
          />
        </label>

        {error && (
          <p role="alert" className="text-variation">
            {error}
          </p>
        )}
        {message && <p className="text-invoice">{message}</p>}

        <button
          type="submit"
          disabled={busy}
          className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? "One sec…" : mode === "signin" ? "Log in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setMessage(null);
        }}
        className="h-12 text-muted underline"
      >
        {mode === "signin"
          ? "First time? Create an account"
          : "Already have an account? Log in"}
      </button>
    </main>
  );
}
