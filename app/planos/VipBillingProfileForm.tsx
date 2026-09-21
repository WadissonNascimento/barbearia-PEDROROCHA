"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, CreditCard, PauseCircle, ShieldCheck } from "lucide-react";
import FeedbackMessage from "@/components/FeedbackMessage";
import type { MutationResult } from "@/lib/mutationResult";
import { saveVipBillingProfileAction } from "./actions";
import VipCreditCardFields from "./VipCreditCardFields";
import VipPaymentMethodFields, { normalizeVipBillingType, VIP_PAYMENT_METHOD_LABELS, type VipBillingType } from "./VipPaymentMethodFields";

const initialState: MutationResult = { ok: true, message: "", tone: "info" };

export default function VipBillingProfileForm({
  cpfCnpj = "",
  currentBillingType,
  requiresUpdate = true,
  paymentsEnabled = true,
  nextPaymentDateLabel,
  preview = false,
}: {
  cpfCnpj?: string | null;
  currentBillingType?: string | null;
  requiresUpdate?: boolean;
  paymentsEnabled?: boolean;
  nextPaymentDateLabel?: string;
  preview?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveVipBillingProfileAction, initialState);
  const currentMethod = normalizeVipBillingType(currentBillingType);
  const [expanded, setExpanded] = useState(requiresUpdate);
  const [billingType, setBillingType] = useState<VipBillingType | "">(requiresUpdate ? "" : currentMethod);
  const [previewSaved, setPreviewSaved] = useState(false);
  const [hideOldFeedback, setHideOldFeedback] = useState(false);
  useEffect(() => setHideOldFeedback(false), [state.message]);
  const saved = previewSaved || (state.ok && Boolean(state.message));
  const updateRequired = requiresUpdate && !saved;
  const isOpen = updateRequired || expanded;
  const displayedMethod = saved ? billingType || currentMethod : currentMethod;

  if (!paymentsEnabled) {
    return (
      <section id="dados-pagamento" className="scroll-mt-24 rounded-xl border border-sky-300/25 bg-sky-300/[0.07] p-3.5 sm:rounded-2xl sm:p-5" aria-labelledby="billing-profile-title">
        <div className="flex items-start gap-3">
          <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" aria-hidden="true" />
          <div>
            <h2 id="billing-profile-title" className="font-black text-sky-100">Pagamentos temporariamente pausados</h2>
            <p className="mt-1 text-xs leading-5 text-sky-100/75 sm:text-sm sm:leading-6">Nenhuma mensalidade será criada ou cobrada enquanto a conta de pagamentos estiver em aprovação. Seu plano, benefícios e agendamentos continuam funcionando normalmente.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="dados-pagamento" className={`scroll-mt-24 rounded-xl border p-3.5 sm:rounded-2xl sm:p-6 ${updateRequired ? "border-[#d9ae55]/45 bg-[#d9ae55]/[0.07]" : "border-white/10 bg-[#0f0e0c]"}`} aria-labelledby="billing-profile-title">
      {updateRequired ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 sm:mb-5 sm:gap-3 sm:rounded-xl sm:p-4" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#e8c57d]" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-[#f5dfaa] sm:text-base">Atualização obrigatória</p>
            <p className="mt-0.5 text-xs leading-5 text-[#d7cbb5] sm:mt-1 sm:text-sm sm:leading-6">Confirme o documento e escolha como deseja pagar para continuar usando o plano.</p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#b4a389] sm:text-[10px] sm:tracking-[0.18em]">Seus dados de pagamento</p>
          <h2 id="billing-profile-title" className="mt-1 text-lg font-black text-[#f8f3e7] sm:mt-2 sm:text-xl">{updateRequired ? "Escolha como pagar" : "Forma de pagamento"}</h2>
          {!updateRequired ? <p className="mt-2 text-sm text-[#c9c0b2]">{displayedMethod ? VIP_PAYMENT_METHOD_LABELS[displayedMethod] : "Não informada"}{saved ? " · Dados atualizados" : " · Dados confirmados"}</p> : null}
        </div>
        {!updateRequired ? (
          <div className="flex flex-wrap gap-2">
            {displayedMethod === "CREDIT_CARD" ? <button type="button" onClick={() => { setExpanded(true); setBillingType("CREDIT_CARD"); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d9ae55]/40 px-4 text-sm font-bold text-[#e8c57d] hover:bg-[#d9ae55]/10"><CreditCard className="h-4 w-4" aria-hidden="true" />Trocar cartão</button> : null}
            <button type="button" aria-expanded={isOpen} aria-controls="vip-billing-form" onClick={() => setExpanded(!isOpen)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold text-[#f5efe3] hover:bg-white/5">{isOpen ? "Fechar edição" : "Alterar forma de pagamento"}<ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>
          </div>
        ) : null}
      </div>
      {isOpen ? (
        <form id="vip-billing-form" action={preview ? undefined : formAction} onSubmit={preview ? (event) => { event.preventDefault(); setPreviewSaved(true); setExpanded(false); } : undefined} className="mt-4 grid gap-4 sm:mt-6 sm:gap-5">
          <label className="grid max-w-md gap-1.5 text-xs font-bold text-[#f5efe3] sm:gap-2 sm:text-sm">
            CPF ou CNPJ
            <input name="cpfCnpj" inputMode="numeric" autoComplete="off" defaultValue={cpfCnpj || ""} required maxLength={18} placeholder="Documento do titular" disabled={pending} className="min-h-11 rounded-lg border border-white/15 bg-black/30 px-3 text-base text-white outline-none focus:border-[#e8c57d] sm:min-h-12 sm:rounded-xl sm:px-4 sm:text-sm" />
          </label>
          <VipPaymentMethodFields value={billingType} onChange={(method) => { setBillingType(method); setHideOldFeedback(true); }} disabled={pending} />
          {billingType === "CREDIT_CARD" ? <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:rounded-xl sm:p-4"><p className="mb-3 text-xs font-bold text-[#f5efe3] sm:mb-4 sm:text-sm">{currentMethod === "CREDIT_CARD" ? "Novo cartão" : "Dados do cartão"}</p><VipCreditCardFields /></div> : null}
          {billingType === "PIX" || billingType === "BOLETO" ? <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-[#c9c0b2]">{billingType === "PIX" ? "Todo mês, acesse a cobrança do seu plano e pague pelo Pix até o vencimento. O pagamento é confirmado automaticamente; não há débito automático na sua conta." : "Todo mês, acesse seu boleto e pague até o vencimento. A confirmação ocorre após a compensação bancária."}</p> : null}
          <div className="flex items-start gap-2 rounded-lg bg-white/[0.035] p-2.5 text-[11px] leading-4 text-[#b9b1a4] sm:bg-transparent sm:p-0 sm:text-xs sm:leading-6"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e8c57d]" aria-hidden="true" /><p>Pagamentos já feitos são preservados.{nextPaymentDateLabel ? ` Próximo vencimento: ${nextPaymentDateLabel}.` : ""}{updateRequired && billingType === "CREDIT_CARD" ? " Se vencer hoje ou estiver atrasado, a cobrança pode ocorrer ao confirmar." : ""}</p></div>
          <button type="submit" disabled={pending || !billingType} className="sticky bottom-2 z-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e8c57d] px-4 text-sm font-black text-[#17120a] shadow-[0_10px_28px_rgba(0,0,0,0.55)] transition hover:bg-[#f4d79f] disabled:cursor-not-allowed disabled:opacity-50 sm:static sm:px-5 sm:shadow-none"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{pending ? "Salvando..." : updateRequired ? "Confirmar pagamento" : "Salvar pagamento"}</button>
        </form>
      ) : null}
      <div aria-live="polite" className={(!hideOldFeedback && state.message) || previewSaved ? "mt-4" : ""}><FeedbackMessage message={previewSaved ? "Prévia: dados confirmados apenas nesta tela. Nenhuma cobrança foi criada." : hideOldFeedback ? "" : state.message} tone={previewSaved ? "success" : state.tone} /></div>
    </section>
  );
}
