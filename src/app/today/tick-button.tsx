"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The big tick on a to-do or follow-up: marks it done.
export default function TickButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function tick() {
    setBusy(true);
    setFailed(false);
    const { error } = await createClient()
      .from("items")
      .update({ status: "done" })
      .eq("id", id);
    if (error) {
      setFailed(true);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={tick}
      disabled={busy}
      aria-label={`Mark done: ${title}`}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 disabled:opacity-50 ${
        failed ? "border-variation text-variation" : "border-line text-invoice"
      }`}
    >
      {busy ? (
        "…"
      ) : failed ? (
        "!"
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12 5 5 9-10" />
        </svg>
      )}
    </button>
  );
}
