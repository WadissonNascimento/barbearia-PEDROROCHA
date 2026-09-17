"use client";

import Link from "next/link";
import { useActionState } from "react";
import { startVipSubscriptionAction } from "./actions";
import type { MutationResult } from "@/lib/mutationResult";
import VipCreditCardFields from "./VipCreditCardFields";

const initialState: MutationResult = { ok: true, message: "", tone: "info" };

export default function VipSubscribeButton({ planCode, signedIn, enrollmentOpen }: { planCode: string; signedIn: boolean; enrollmentOpen: boolean }) {
  const [state, formAction, pending] = useActionState(startVipSubscriptionAction, initialState);
  if (!enrollmentOpen) {
    return <p className="mt-6 rounded-lg border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-center text-sm font-black text-amber-100">Inscrições encerradas no momento</p>;
  }
  if (!signedIn) {
    return <Link href="/login?redirectTo=%2Fplanos" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#f1e8d8] px-5 text-sm font-black text-[#080807]">Entrar para assinar</Link>;
  }
  return (
    <form action={formAction} className="mt-6 grid gap-2">
      <input type="hidden" name="planCode" value={planCode} />
      <label className="grid gap-2 text-sm font-bold text-[#f5efe3]">
        CPF ou CNPJ
        <input name="cpfCnpj" inputMode="numeric" required maxLength={18} className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
      </label>
      <VipCreditCardFields />
      <button type="submit" disabled={pending} className="min-h-12 rounded-lg bg-[#f1e8d8] px-5 text-sm font-black text-[#080807] disabled:opacity-60">{pending ? "Criando..." : "Assinar plano"}</button>
      {state.message ? <p className={state.ok ? "text-xs text-emerald-300" : "text-xs text-red-300"}>{state.message}</p> : null}
    </form>
  );
}
