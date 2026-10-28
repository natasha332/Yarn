import Link from "next/link";
import Recorder from "./recorder";

export default function CapturePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/" className="flex h-12 items-center text-muted underline">
        ← Home
      </Link>
      <h1 className="font-display text-5xl font-bold leading-none">Talk</h1>
      <Recorder />
    </main>
  );
}
