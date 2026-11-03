"use client";

import { useEffect } from "react";
import { showToast } from "@/lib/toast";

// After Save (or coming back from Google) the page reloads at the top. This pops the result up at
// the bottom of the screen, where it can be seen wherever on the page you were.
export default function Flash({ message }: { message: string | null }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => showToast(message), 100);
    return () => clearTimeout(timer);
  }, [message]);
  return null;
}
