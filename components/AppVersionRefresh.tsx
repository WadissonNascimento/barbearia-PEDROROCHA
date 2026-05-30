"use client";

import { useEffect, useRef } from "react";

const INACTIVE_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;
const VERSION_ENDPOINT = "/api/app-version";

type AppVersionResponse = {
  version?: string;
};

async function fetchAppVersion() {
  const response = await fetch(VERSION_ENDPOINT, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as AppVersionResponse | null;
  return typeof payload?.version === "string" && payload.version
    ? payload.version
    : null;
}

function isAuthEntryPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password")
  );
}

export default function AppVersionRefresh() {
  const currentVersionRef = useRef<string | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function rememberCurrentVersion() {
      const version = await fetchAppVersion();

      if (!cancelled && version) {
        currentVersionRef.current = version;
      }
    }

    async function refreshIfVersionChanged(forceCheck = false) {
      if (checkingRef.current || isAuthEntryPath(window.location.pathname)) {
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      const inactiveForMs = hiddenAt ? Date.now() - hiddenAt : 0;

      if (!forceCheck && inactiveForMs < INACTIVE_REFRESH_THRESHOLD_MS) {
        return;
      }

      checkingRef.current = true;

      try {
        const latestVersion = await fetchAppVersion();
        const currentVersion = currentVersionRef.current;

        if (latestVersion && currentVersion && latestVersion !== currentVersion) {
          window.location.reload();
          return;
        }

        if (latestVersion) {
          currentVersionRef.current = latestVersion;
        }
      } finally {
        checkingRef.current = false;
        hiddenAtRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      void refreshIfVersionChanged();
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void refreshIfVersionChanged(true);
        return;
      }

      void refreshIfVersionChanged();
    }

    function handleFocus() {
      void refreshIfVersionChanged();
    }

    void rememberCurrentVersion();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
