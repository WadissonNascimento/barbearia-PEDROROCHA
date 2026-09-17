"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, CreditCard, ShieldCheck } from "lucide-react";
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
  nextPaymentDateLabel,
  preview = false,
}: {
  cpfCnpj?: string | null;
  currentBillingType?: string | null;
  requiresUpdate?: boolean;
  nextPaymentDateLabel?: string;
  preview?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveVipBillingProfileAction, initialState);
  const currentMethod = normalizeVipBillingType(currentBillingType);
  const [expanded, setExpanded] = useState(requiresUpdate);
  const [billingType, setBillingType] = useState<VipBillingType | "">(requiresUpdate ? "" : currentMethod);
  const [previewSaved, setPreviewSaved] = useState(false);
  const saved = previewSaved || (state.ok && Boolean(state.message));
  const updateRequired = requiresUpdate && !saved;
  const isOpen = updateRequired || expanded;
  const displayedMethod = saved ? billingType || currentMethod : currentMethod;

  return (
    <section id="dados-pagamento" className={`scroll-mt-24 rounded-2xl border p-5 sm:p-6 ${updateRequired ? "border-[#d9ae55]/45 bg-[#d9ae55]/[0.07]" : "border-white/10 bg-[#0f0e0c]"}`} aria-labelledby="billing-profile-title">
      {updateRequired ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#e8c57d]" aria-hidden="true" />
          <div>
            <p className="font-bold text-[#f5dfaa]">Atualização obrigatória para todos os assinantes</p>
            <p className="mt-1 text-sm leading-6 text-[#d7cbb5]">Confirme seu CPF/CNPJ e escolha como deseja pagar, mesmo que já tenha cadastrado um cartão. Conclua esta etapa para continuar usando seu plano.</p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b4a389]">Seus dados de pagamento</p>
          <h2 id="billing-profile-title" className="mt-2 text-xl font-black text-[#f8f3e7]">{updateRequired ? "Escolha sua forma de pagamento" : "Forma de pagamento"}</h2>
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
        <form id="vip-billing-form" action={preview ? undefined : formAction} onSubmit={preview ? (event) => { event.preventDefault(); setPreviewSaved(true); setExpanded(false); } : undefined} className="mt-6 grid gap-5">
          <label className="grid max-w-md gap-2 text-sm font-bold text-[#f5efe3]">
            CPF ou CNPJ
            <input name="cpfCnpj" inputMode="numeric" autoComplete="off" defaultValue={cpfCnpj || ""} required maxLength={18} placeholder="Informe o documento do titular" disabled={pending} className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
          </label>
          <VipPaymentMethodFields value={billingType} onChange={setBillingType} disabled={pending} />
          {billingType === "CREDIT_CARD" ? <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="mb-4 text-sm font-bold text-[#f5efe3]">{currentMethod === "CREDIT_CARD" ? "Informe o cartão que deseja usar a partir de agora" : "Dados do cartão de crédito"}</p><VipCreditCardFields /></div> : null}
          {billingType === "PIX" || billingType === "BOLETO" ? <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-[#c9c0b2]">{billingType === "PIX" ? "Todo mês, acesse a cobrança do seu plano e pague pelo Pix até o vencimento. O pagamento é confirmado automaticamente; não há débito automático na sua conta." : "Todo mês, acesse seu boleto e pague até o vencimento. A confirmação ocorre após a compensação bancária."}</p> : null}
          <div className="flex items-start gap-2 text-xs leading-6 text-[#b9b1a4]"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#e8c57d]" aria-hidden="true" /><p>Seu plano, histórico e mensalidades já pagas são preservados. Atualizar os dados não cobra novamente um mês pago.{nextPaymentDateLabel ? ` Vencimento previsto: ${nextPaymentDateLabel}.` : ""}</p></div>
          {updateRequired && billingType === "CREDIT_CARD" ? <p className="text-xs leading-6 text-[#d7cbb5]">Se houver uma mensalidade vencida ou vencendo hoje, a cobrança pode ocorrer ao confirmar o cartão. Mensalidades futuras serão cobradas no vencimento.</p> : null}
          <button type="submit" disabled={pending || !billingType} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e8c57d] px-5 text-sm font-black text-[#17120a] transition hover:bg-[#f4d79f] disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{pending ? "Salvando dados..." : updateRequired ? "Confirmar dados e forma de pagamento" : "Salvar forma de pagamento"}</button>
        </form>
      ) : null}
      <div aria-live="polite" className={state.message || previewSaved ? "mt-4" : ""}><FeedbackMessage message={previewSaved ? "Prévia: dados confirmados apenas nesta tela. Nenhuma cobrança foi criada." : state.message} tone={previewSaved ? "success" : state.tone} /></div>
    </section>
  );
}
