"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// A form button that shows it's been pressed: it dims, locks and says what it's doing until the page comes back.
export default function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "outline";
}) {
  const { pending } = useFormStatus();
  const look =
    variant === "primary"
      ? "h-14 w-full bg-accent text-lg text-accent-ink"
      : "h-12 border border-line px-5";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`rounded-xl font-semibold disabled:opacity-60 ${look}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
