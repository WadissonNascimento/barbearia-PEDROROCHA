"use client";

import { useActionState } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import type { MutationResult } from "@/lib/mutationResult";
import { saveVipBillingProfileAction } from "./actions";
import VipCreditCardFields from "./VipCreditCardFields";

const initialState: MutationResult = { ok: true, message: "", tone: "info" };

export default function VipBillingProfileForm() {
  const [state, formAction, pending] = useActionState(
    saveVipBillingProfileAction,
    initialState
  );

  return (
    <section className="mt-5 rounded-2xl border border-[#d9ae55]/35 bg-[#d9ae55]/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e8c57d]">
        Cobrança automática
      </p>
      <h2 className="mt-2 text-xl font-black text-[#f8f3e7]">Complete seus dados de pagamento</h2>
      <p className="mt-2 text-sm leading-6 text-[#c9c0b2]">
        Sua conta, histórico e benefícios permanecem os mesmos. Informe o CPF/CNPJ e o cartão que será usado nas cobranças mensais automáticas.
      </p>
      <form action={formAction} className="mt-4 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-[#f5efe3]">
          CPF ou CNPJ
          <input
            name="cpfCnpj"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={18}
            placeholder="Somente números"
            className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]"
          />
        </label>
        <VipCreditCardFields />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-[#f1e8d8] px-5 text-sm font-black text-[#080807] disabled:opacity-60"
        >
          {pending ? "Validando cartão..." : "Ativar cobrança no cartão"}
        </button>
      </form>
      <div className="mt-3"><FeedbackMessage message={state.message} tone={state.tone} /></div>
    </section>
  );
}
