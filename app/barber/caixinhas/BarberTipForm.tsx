"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import FeedbackMessage from "@/components/FeedbackMessage";
import SubmitButton from "@/components/SubmitButton";
import type { MutationResult } from "@/lib/mutationResult";
import { createBarberTipAction } from "./actions";

const initialState: MutationResult | null = null;

export default function BarberTipForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createBarberTipAction, initialState);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      {state ? <FeedbackMessage message={state.message} tone={state.tone} /> : null}

      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          Cliente que deu a caixinha
        </span>
        <input
          name="clientName"
          type="text"
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Ex: Antonio"
          className="min-h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/15"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          Valor da caixinha
        </span>
        <input
          name="amount"
          type="text"
          required
          inputMode="decimal"
          placeholder="Ex: 50,00"
          className="min-h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/15"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          Observacao opcional
        </span>
        <textarea
          name="note"
          rows={4}
          maxLength={500}
          placeholder="Ex: cliente deixou em dinheiro"
          className="resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/50 focus:ring-2 focus:ring-[var(--brand)]/15"
        />
      </label>

      <SubmitButton idleText="Anotar caixinha" loadingText="Salvando..." />
    </form>
  );
}
