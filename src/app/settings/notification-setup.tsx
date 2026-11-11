"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";

// "Notifications on this phone": asks the phone for permission, gets its push address, and gives it to Yarn.
// Each phone or computer is turned on separately.

type Status =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "blocked"
  | "off"
  | "on";

const urlBase64ToBytes = (base64: string) => {
  const padded = base64
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const deviceName = () => {
  const ua = navigator.userAgent;
  const kind = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Mac/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "Device";
  const app = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "browser";
  return `${kind} ${app}`;
};

async function post(path: string, body: unknown) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => null)) as {
      status?: string;
      message?: string;
    } | null;
  } catch {
    return null;
  }
}

export default function NotificationSetup({
  publicKey,
}: {
  publicKey: string | null;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Status;
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true;
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        next = ios && !installed ? "needs-install" : "unsupported";
      } else if (Notification.permission === "denied") {
        next = "blocked";
      } else {
        const registration = await navigator.serviceWorker.ready.catch(
          () => null,
        );
        const existing = registration
          ? await registration.pushManager.getSubscription().catch(() => null)
          : null;
        next = existing && Notification.permission === "granted" ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    if (!publicKey)
      return showToast("⚠ Notifications aren't set up on the server yet.");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(publicKey),
        }));
      const saved = await post("/api/push/subscribe", {
        subscription: subscription.toJSON(),
        device: deviceName(),
      });
      if (saved?.status !== "saved") {
        await subscription.unsubscribe().catch(() => {});
        showToast(
          `⚠ ${saved?.message ?? "Couldn't turn notifications on. Try again."}`,
        );
        return;
      }
      setStatus("on");
      showToast("✓ Notifications are on for this phone");
    } catch {
      showToast("⚠ Couldn't turn notifications on. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await post("/api/push/unsubscribe", {
          endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe().catch(() => {});
      }
      setStatus("off");
      showToast("Notifications are off for this phone");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return setStatus("off");
      const result = await post("/api/push/test", {
        endpoint: subscription.endpoint,
      });
      if (result?.status === "sent")
        showToast("✓ Sent. It should appear in a moment");
      else {
        if (result?.status === "gone") setStatus("off");
        showToast(`⚠ ${result?.message ?? "Couldn't send. Try again."}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const button =
    "h-12 rounded-xl border border-line bg-surface px-4 font-semibold disabled:opacity-50";
  if (status === "checking") return <p className="text-muted">One sec…</p>;
  if (status === "needs-install") {
    return (
      <p className="text-muted">
        On iPhone, notifications only work once Yarn is on your Home Screen. Tap
        the Share button, choose <b className="text-ink">Add to Home Screen</b>,
        then open Yarn from there and come back to this page.
      </p>
    );
  }
  if (status === "unsupported")
    return (
      <p className="text-muted">
        This browser can&apos;t show notifications. Try Chrome on your phone.
      </p>
    );
  if (status === "blocked") {
    return (
      <p className="text-muted">
        Notifications are blocked for Yarn on this phone. Open your phone&apos;s
        settings (or tap the lock icon next to the address in your browser),
        allow notifications for Yarn, then come back.
      </p>
    );
  }
  return status === "on" ? (
    <div className="flex flex-col gap-3">
      <p>
        <span className="font-semibold text-invoice">✓ On</span> for this phone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendTest}
          disabled={busy}
          className={button}
        >
          Send me a test notification
        </button>
        <button
          type="button"
          onClick={turnOff}
          disabled={busy}
          className={`${button} text-muted`}
        >
          Turn off
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={turnOn}
      disabled={busy}
      className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
    >
      {busy ? "One sec…" : "Turn on notifications on this phone"}
    </button>
  );
}
