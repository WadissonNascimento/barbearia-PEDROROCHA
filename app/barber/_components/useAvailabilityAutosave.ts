"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { MutationResult } from "@/lib/mutationResult";

type Values = Record<string, string | number | boolean>;

/** Serializes edits per row so a slower response cannot overwrite a newer edit. */
export function useAvailabilityAutosave<T extends Values>(
  initial: T,
  action: (data: FormData) => Promise<MutationResult>,
  validate: (value: T) => string | null,
) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState("Pronto");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, startTransition] = useTransition();
  const key = JSON.stringify(value);
  const saved = useRef(key);
  const failed = useRef<string | null>(null);
  const busy = useRef(false);
  const latest = useRef({ value, key, action, validate });
  useEffect(() => {
    latest.current = { value, key, action, validate };
  }, [value, key, action, validate]);

  useEffect(() => {
    if (key === saved.current) {
      if (!busy.current) { setError(false); setStatus("Salvo"); }
      return;
    }
    if (key === failed.current) return;
    const message = latest.current.validate(latest.current.value);
    if (message) {
      setError(true);
      setStatus(message);
      return;
    }
    setError(false);
    setStatus("Alterações pendentes…");
    const timer = setTimeout(() => {
      if (busy.current) return;
      const snapshot = latest.current;
      const data = new FormData();
      Object.entries(snapshot.value).forEach(([name, entry]) => data.set(name, String(entry)));
      busy.current = true;
      setStatus("Salvando…");
      startTransition(async () => {
        try {
          const result = await snapshot.action(data);
          if (result.ok) saved.current = snapshot.key;
          else failed.current = snapshot.key;
          if (latest.current.key === snapshot.key) {
            setError(!result.ok);
            setStatus(result.ok ? "Salvo" : result.message);
          }
        } catch {
          failed.current = snapshot.key;
          if (latest.current.key === snapshot.key) {
            setError(true);
            setStatus("Não foi possível salvar. Tente novamente.");
          }
        } finally {
          busy.current = false;
          setAttempt((current) => current + 1);
        }
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [key, attempt]);

  useEffect(() => {
    if (key === saved.current) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [key]);

  return {
    value, status, error,
    update: (patch: Partial<T>) => setValue((current) => ({ ...current, ...patch })),
    retry: () => { failed.current = null; setAttempt((current) => current + 1); },
  };
}
