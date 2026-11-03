// The browser side of "keep Google Calendar in step with Yarn". It never throws:
// if anything goes wrong the booking is still safely saved in Yarn.

export type SyncStatus =
  | "created"
  | "updated"
  | "deleted"
  | "uptodate"
  | "skipped"
  | "not_connected"
  | "reconnect"
  | "error";

export async function syncBooking(itemId: string, create: boolean): Promise<{ status: SyncStatus; message?: string }> {
  try {
    const res = await fetch("/api/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, create }),
    });
    const body = await res.json().catch(() => null);
    if (body?.status) return body;
  } catch {
    // offline or the server didn't answer
  }
  return { status: "error", message: "Couldn't reach Google Calendar just now." };
}

// A few words to add to a "✓ Moved it" message, or null when there's nothing worth saying
// (for example she hasn't connected Google, or there was nothing to change).
export function syncNote(status: SyncStatus): string | null {
  switch (status) {
    case "created":
      return "added to Google Calendar";
    case "updated":
      return "Google Calendar updated";
    case "deleted":
      return "removed from Google Calendar";
    case "reconnect":
      return "⚠ Google needs reconnecting (Settings)";
    case "error":
      return "⚠ Google Calendar didn't update, tap Try again on Today";
    default:
      return null;
  }
}

// The same thing as a message of its own, for the pop-up at the bottom of the screen.
export function syncToast(status: SyncStatus): string | null {
  const note = syncNote(status);
  if (!note) return null;
  return note.startsWith("⚠") ? note : `✓ ${note[0].toUpperCase()}${note.slice(1)}`;
}
