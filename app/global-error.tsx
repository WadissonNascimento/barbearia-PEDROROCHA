"use client";

import { useEffect } from "react";

const GLOBAL_RELOAD_FLAG = "jakbarber-global-error-reload-v2";

function getCacheBustedUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("__recover", String(Date.now()));
  return url.toString();
}

function reportClientError(error: Error & { digest?: string }) {
  const payload = JSON.stringify({
    source: "global-error",
    path: window.location.href,
    message: error.message,
    stack: error.stack,
    digest: error.digest,
    userAgent: window.navigator.userAgent,
  });

  try {
    if (window.navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      window.navigator.sendBeacon("/api/client-errors", blob);
      return;
    }
  } catch {
    // Fall back to fetch below.
  }

  fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);

    const timeout = window.setTimeout(() => {
      try {
        const attempts = Number(window.sessionStorage.getItem(GLOBAL_RELOAD_FLAG) || "0");
        if (attempts >= 2) return;
        window.sessionStorage.setItem(GLOBAL_RELOAD_FLAG, String(attempts + 1));
      } catch {
        // Storage can be unavailable in private mobile sessions.
      }

      window.location.replace(getCacheBustedUrl());
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#030712] text-white">
        <main className="flex min-h-screen items-center justify-center px-5">
          <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300">
              Sistema
            </p>
            <h1 className="mt-3 text-2xl font-bold">Vamos recarregar o painel</h1>
            <p className="mt-3 text-sm text-zinc-300">
              O painel encontrou uma falha no carregamento. Vamos tentar abrir
              novamente com tudo atualizado.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    window.sessionStorage.removeItem(GLOBAL_RELOAD_FLAG);
                  } catch {
                    // Storage can be unavailable in private mobile sessions.
                  }
                  reset();
                  window.location.replace(getCacheBustedUrl());
                }}
                className="rounded-2xl bg-[#0ea5e9] px-5 py-3 font-semibold text-white"
              >
                Tentar novamente
              </button>
              <a
                href="/login"
                className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white"
              >
                Voltar para login
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
