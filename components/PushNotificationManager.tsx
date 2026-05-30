"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

const DISMISSED_KEY = "jakbarber-push-prompt-dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function canUsePush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext
  );
}

export default function PushNotificationManager({
  publicKey,
}: {
  publicKey?: string | null;
}) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const subscribeToPush = useCallback(async () => {
    if (!publicKey || !canUsePush()) {
      return false;
    }

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const existingSubscription =
      await registration.pushManager.getSubscription();
    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    return response.ok;
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey || !canUsePush()) {
      return;
    }

    if (Notification.permission === "granted") {
      void subscribeToPush();
      return;
    }

    if (Notification.permission === "default") {
      const dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";

      if (!dismissed) {
        const timer = window.setTimeout(() => setCanPrompt(true), 1200);
        return () => window.clearTimeout(timer);
      }
    }
  }, [publicKey, subscribeToPush]);

  async function handleEnable() {
    if (!publicKey || isSubscribing) {
      return;
    }

    setIsSubscribing(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        const ok = await subscribeToPush();

        if (ok) {
          setCanPrompt(false);
        }
      } else {
        window.localStorage.setItem(DISMISSED_KEY, "1");
        setCanPrompt(false);
      }
    } finally {
      setIsSubscribing(false);
    }
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setCanPrompt(false);
  }

  if (!canPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[220] mx-auto max-w-sm rounded-3xl border border-white/10 bg-[#08111f]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand-strong)]/40 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
          <Bell className="h-5 w-5" strokeWidth={2.3} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Ativar notificacoes no celular</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Receba avisos mesmo com o app fechado ou instalado como PWA.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Dispensar notificacoes"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleEnable}
        disabled={isSubscribing}
        className="mt-4 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(14,165,233,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubscribing ? "Ativando..." : "Ativar notificacoes"}
      </button>
    </div>
  );
}
