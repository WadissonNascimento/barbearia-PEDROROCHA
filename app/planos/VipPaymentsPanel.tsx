import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Wallet } from "lucide-react";
import { safeAsaasInvoiceUrl } from "@/lib/vipMigration";
import { getVipDueDayLabel } from "@/lib/vipDueDate";
import VipBillingProfileForm from "./VipBillingProfileForm";

export type VipPaymentView = {
  id: string;
  cycleMonth: string;
  amount: number;
  status: string;
  dueDate: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  asaasStatus?: string | null;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function paymentDateLabel(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export default function VipPaymentsPanel({
  price, dueDay, nextDueDate, paymentStatusLabel, paymentPaid, cpfCnpj,
  currentBillingType, requiresUpdate, payments, preview = false,
}: {
  price: number;
  dueDay: number;
  nextDueDate: string;
  paymentStatusLabel: string;
  paymentPaid: boolean;
  cpfCnpj?: string | null;
  currentBillingType?: string | null;
  requiresUpdate: boolean;
  payments: VipPaymentView[];
  preview?: boolean;
}) {
  return (
    <section className="space-y-5" aria-labelledby="vip-payments-title">
      <div className="flex items-center gap-3">
        <span className="rounded-xl border border-[#e8c57d]/25 bg-[#e8c57d]/10 p-3 text-[#e8c57d]"><Wallet className="h-5 w-5" aria-hidden="true" /></span>
        <div><h2 id="vip-payments-title" className="text-2xl font-black text-[#f8f3e7]">Pagamento do seu plano</h2><p className="mt-1 text-sm text-[#b9b1a4]">Tudo sobre sua mensalidade, em um só lugar.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#11100e] p-5">
          <p className="text-xs text-[#b9b1a4]">Mensalidade</p>
          <p className="mt-2 text-2xl font-black text-[#f8f3e7]">{money(price)}</p>
          <p className="mt-2 text-xs text-[#b9b1a4]">Uma cobrança por mês</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#11100e] p-5">
          <p className="flex items-center gap-2 text-xs text-[#b9b1a4]"><CalendarDays className="h-4 w-4" aria-hidden="true" />{paymentPaid ? "Próximo vencimento" : "Vencimento da mensalidade"}</p>
          <p className="mt-2 font-bold text-[#f8f3e7]">{paymentDateLabel(nextDueDate)}</p>
          <p className="mt-2 text-xs leading-5 text-[#b9b1a4]">{dueDay === 5 ? "5º dia útil · sábado conta; domingos e feriados nacionais não contam." : `Todo ${getVipDueDayLabel(dueDay)}`}</p>
        </div>
        <div className={`rounded-xl border p-5 ${paymentPaid ? "border-emerald-300/20 bg-emerald-400/[0.06]" : "border-amber-300/20 bg-amber-300/[0.06]"}`}>
          <p className="text-xs text-[#b9b1a4]">Situação do pagamento</p>
          <p className={`mt-2 flex items-center gap-2 font-bold ${paymentPaid ? "text-emerald-200" : "text-amber-200"}`}>{paymentPaid ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />}{paymentStatusLabel}</p>
          <p className="mt-2 text-xs leading-5 text-[#b9b1a4]">A atualização cadastral não altera uma mensalidade já quitada.</p>
        </div>
      </div>
      <VipBillingProfileForm cpfCnpj={cpfCnpj} currentBillingType={currentBillingType} requiresUpdate={requiresUpdate} nextPaymentDateLabel={paymentDateLabel(nextDueDate)} preview={preview} />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f0e0c]">
        <div className="border-b border-white/10 p-5">
          <h3 className="font-bold text-[#f8f3e7]">Suas mensalidades</h3>
          <p className="mt-1 text-xs leading-5 text-[#b9b1a4]">No Pix ou boleto, abra a cobrança para pagar. No cartão, acompanhe a cobrança automática.</p>
        </div>
        {payments.length ? <div className="divide-y divide-white/10">{payments.map(payment => {
          const paid = payment.status === "PAID";
          const unavailable = ["DELETED", "REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"].includes(payment.asaasStatus || "");
          const invoice = safeAsaasInvoiceUrl(payment.invoiceUrl);
          const boleto = currentBillingType === "BOLETO" ? safeAsaasInvoiceUrl(payment.bankSlipUrl) : null;
          const link = boleto || invoice;
          const cycleLabel = new Date(`${payment.cycleMonth}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
          return (
            <article key={payment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-bold capitalize text-[#f5efe3]">{cycleLabel} <span className="ml-2 text-[#c9c0b2]">{money(payment.amount)}</span></p><p className="mt-1 text-xs text-[#b9b1a4]">{payment.dueDate ? `Vencimento: ${paymentDateLabel(payment.dueDate)}` : "Vencimento a confirmar"}</p></div>
              {paid ? <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 sm:self-center"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Pago</span>
                : link && !unavailable && !preview ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e8c57d]/40 px-4 text-sm font-bold text-[#e8c57d] hover:bg-[#e8c57d]/10">{currentBillingType === "PIX" ? "Pagar com Pix" : currentBillingType === "BOLETO" ? "Abrir boleto" : "Ver cobrança"}<ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
                  : <span className="text-sm text-[#c9c0b2]">{preview ? "Cobrança ilustrativa" : unavailable ? "Fale com a barbearia" : "Aguardando disponibilização da cobrança"}</span>}
            </article>
          );
        })}</div> : <p className="p-5 text-sm leading-6 text-[#b9b1a4]">Suas cobranças aparecerão aqui após a confirmação dos dados e a emissão da mensalidade.</p>}
      </div>
    </section>
  );
}
