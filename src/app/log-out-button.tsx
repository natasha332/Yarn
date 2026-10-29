"use client";

// Logging out also forgets the copy of your signed-in home screen that Yarn keeps for offline use,
// so nobody else using this phone can open your notes without a login.
export default function LogOutButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={() => {
        caches
          .open("yarn-pages-v1")
          .then((cache) => cache.delete("/"))
          .catch(() => {});
      }}
    >
      <button className="h-12 px-6 text-muted underline">Log out</button>
    </form>
  );
}
