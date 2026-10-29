"use client";

import { useEffect, useState } from "react";
import { TOAST } from "@/lib/toast";

export default function Toast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onToast(e: Event) {
      setMessage((e as CustomEvent<{ message: string }>).detail.message);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 5000);
    }
    window.addEventListener(TOAST, onToast);
    return () => {
      window.removeEventListener(TOAST, onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-center font-semibold text-surface shadow-lg"
    >
      {message}
    </div>
  );
}
