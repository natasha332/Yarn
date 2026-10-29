// Notes waiting on the phone itself (IndexedDB) until they can be uploaded.
// Only ever used from the browser.

export type PendingNote = {
  id: string; // also the id of the capture it will become
  businessId: string;
  userId: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
  uploadedPath?: string; // set once the audio file is safely in storage
};

// Fired whenever the list of waiting notes changes, so the screen can update.
export const QUEUE_CHANGED = "yarn-queue-changed";
// Fired when a waiting note finally made it into Yarn's cloud.
export const NOTE_SYNCED = "yarn-note-synced";

const DB_NAME = "yarn";
const STORE = "pending-notes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function queueChanged() {
  window.dispatchEvent(new Event(QUEUE_CHANGED));
}

export async function putPending(note: PendingNote) {
  await run("readwrite", (s) => s.put(note));
}

export async function removePending(id: string) {
  await run("readwrite", (s) => s.delete(id));
}

export async function listPending(userId: string): Promise<PendingNote[]> {
  const all = await run<PendingNote[]>("readonly", (s) => s.getAll());
  return all
    .filter((n) => n.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
