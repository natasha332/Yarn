"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The menu bar along the bottom of the screen (Talk, Today, Jobs, Clients).
// It isn't shown on the sign-in and setup screens.
const HIDDEN_ON = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/auth",
];

const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TABS = [
  {
    href: "/",
    label: "Talk",
    match: (p: string) => p === "/",
    svg: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...icon}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
  },
  {
    href: "/today",
    label: "Today",
    match: (p: string) => p.startsWith("/today"),
    svg: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...icon}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/jobs",
    label: "Jobs",
    match: (p: string) => p.startsWith("/jobs"),
    svg: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...icon}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
      </svg>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    match: (p: string) => p.startsWith("/clients"),
    svg: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...icon}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* keeps the bottom of each page clear of the bar */}
      <div
        aria-hidden="true"
        className="h-[calc(4.5rem+env(safe-area-inset-bottom))] shrink-0"
      />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[4.5rem] flex-col items-center justify-center gap-1 text-xs font-semibold ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  {tab.svg}
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
