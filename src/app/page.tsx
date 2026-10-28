export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="font-display text-6xl font-bold leading-none">
        yarn<span className="text-accent">.</span>
      </h1>
      <p className="text-lg text-muted">Talk, don&apos;t type.</p>
      <button className="h-28 w-28 rounded-full bg-accent text-accent-ink font-semibold shadow-[0_0_0_10px_color-mix(in_srgb,var(--accent)_16%,transparent)]">
        Talk
      </button>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        Wed 28 Oct
      </p>
    </main>
  );
}
