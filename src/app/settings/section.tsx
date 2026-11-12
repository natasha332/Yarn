import type { ReactNode } from "react";

// One settings area as a tidy row: a title, a one-line summary of where it stands, and a chevron.
// Tap the row to open it. (The outer <section> is kept so each area is still a landmark.)
export function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0 text-muted transition-transform group-open:rotate-180"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Section({
  title,
  summary,
  open = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <details
        open={open}
        className="group rounded-2xl border border-line bg-surface"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="font-display text-2xl font-bold leading-none">
              {title}
            </h2>
            {summary ? <span className="text-muted">{summary}</span> : null}
          </span>
          <Chevron />
        </summary>
        <div className="flex flex-col gap-4 border-t border-line p-4">
          {children}
        </div>
      </details>
    </section>
  );
}
