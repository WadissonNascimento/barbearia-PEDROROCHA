import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Wallet } from "lucide-react";
import { safeAsaasInvoiceUrl } from "@/lib/vipMigration";
import { getVipDueDayLabel } from "@/lib/vipDueDate";
import VipBillingProfileForm from "./VipBillingProfileForm";
import VipPixPayment from "./VipPixPayment";

export type VipPaymentView = {
  id: string;
  cycleMonth: string;
  amount: number;
  status: string;
  dueDate: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
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
  paymentsEnabled = true,
}: {
  price: number;
  dueDay: number;
  nextDueDate: string;
  paymentStatusLabel: string;
  paymentPaid: boolean;
  cpfCnpj?: string | null;
  currentBillingType?: string | null;
  requiresUpdate: boolean;
  paymentsEnabled?: boolean;
  payments: VipPaymentView[];
  preview?: boolean;
}) {
  return (
    <section className="space-y-4 sm:space-y-5" aria-labelledby="vip-payments-title">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="rounded-lg border border-[#e8c57d]/25 bg-[#e8c57d]/10 p-2 text-[#e8c57d] sm:rounded-xl sm:p-3"><Wallet className="h-5 w-5" aria-hidden="true" /></span>
        <div><h2 id="vip-payments-title" className="text-xl font-black text-[#f8f3e7] sm:text-2xl">Pagamento do plano</h2><p className="mt-0.5 text-xs text-[#b9b1a4] sm:mt-1 sm:text-sm">Mensalidade e forma de pagamento.</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="rounded-lg border border-white/10 bg-[#11100e] p-3 sm:rounded-xl sm:p-5">
          <p className="text-xs text-[#b9b1a4]">Mensalidade</p>
          <p className="mt-1 text-xl font-black text-[#f8f3e7] sm:mt-2 sm:text-2xl">{money(price)}</p>
          <p className="mt-1 hidden text-xs text-[#b9b1a4] sm:mt-2 sm:block">Uma cobrança por mês</p>
        </div>
        <div className={`rounded-lg border p-3 sm:order-3 sm:rounded-xl sm:p-5 ${paymentPaid ? "border-emerald-300/20 bg-emerald-400/[0.06]" : "border-amber-300/20 bg-amber-300/[0.06]"}`}>
          <p className="text-xs text-[#b9b1a4]">Situação</p>
          <p className={`mt-1 flex items-start gap-1.5 text-xs font-bold leading-5 sm:mt-2 sm:items-center sm:text-base ${paymentPaid ? "text-emerald-200" : "text-amber-200"}`}>{paymentPaid ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden="true" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden="true" />}{paymentStatusLabel}</p>
          <p className="mt-2 hidden text-xs leading-5 text-[#b9b1a4] sm:block">Atualizar dados não altera mensalidades quitadas.</p>
        </div>
        <div className="col-span-2 rounded-lg border border-white/10 bg-[#11100e] p-3 sm:col-span-1 sm:order-2 sm:rounded-xl sm:p-5">
          <p className="flex items-center gap-2 text-xs text-[#b9b1a4]"><CalendarDays className="h-4 w-4" aria-hidden="true" />{paymentPaid ? "Próximo vencimento" : "Vencimento da mensalidade"}</p>
          <p className="mt-1 text-sm font-bold text-[#f8f3e7] sm:mt-2 sm:text-base">{paymentDateLabel(nextDueDate)}</p>
          <p className="mt-1 text-[11px] leading-4 text-[#b9b1a4] sm:mt-2 sm:text-xs sm:leading-5">{dueDay === 5 ? "5º dia útil · sábado conta." : `Todo ${getVipDueDayLabel(dueDay)}`}</p>
        </div>
      </div>
      <VipBillingProfileForm cpfCnpj={cpfCnpj} currentBillingType={currentBillingType} requiresUpdate={requiresUpdate} paymentsEnabled={paymentsEnabled} nextPaymentDateLabel={paymentDateLabel(nextDueDate)} preview={preview} />
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0e0c] sm:rounded-2xl">
        <div className="border-b border-white/10 p-3.5 sm:p-5">
          <h3 className="font-bold text-[#f8f3e7]">Suas mensalidades</h3>
          <p className="mt-1 text-[11px] leading-4 text-[#b9b1a4] sm:text-xs sm:leading-5">{paymentsEnabled ? "No Pix ou boleto, abra a cobrança para pagar. No cartão, acompanhe a cobrança automática." : "Novas cobranças estão pausadas durante a aprovação da conta."}</p>
        </div>
        {payments.length ? <div className="divide-y divide-white/10">{payments.map(payment => {
          const paid = payment.status === "PAID";
          const unavailable = ["DELETED", "REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"].includes(payment.asaasStatus || "");
          const boleto = currentBillingType === "BOLETO" ? safeAsaasInvoiceUrl(payment.bankSlipUrl) : null;
          const invoice = safeAsaasInvoiceUrl(payment.invoiceUrl);
          const link = boleto || invoice;
          const cycleLabel = new Date(`${payment.cycleMonth}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
          return (
            <article key={payment.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div><p className="font-bold capitalize text-[#f5efe3]">{cycleLabel} <span className="ml-2 text-[#c9c0b2]">{money(payment.amount)}</span></p><p className="mt-1 text-xs text-[#b9b1a4]">{payment.dueDate ? `Vencimento: ${paymentDateLabel(payment.dueDate)}` : "Vencimento a confirmar"}</p></div>
              {paid ? <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 sm:self-center"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Pago</span>
                : paymentsEnabled && currentBillingType === "PIX" && payment.pixCopyPaste && payment.pixQrCode && !unavailable && !preview ? <VipPixPayment qrCode={payment.pixQrCode} copyPaste={payment.pixCopyPaste} amount={payment.amount} />
                : paymentsEnabled && currentBillingType === "PIX" && !unavailable && !preview ? <span className="text-xs leading-5 text-[#c9c0b2] sm:text-sm">Gerando QR Code Pix. Atualize a página em instantes.</span>
                : paymentsEnabled && link && !unavailable && !preview ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e8c57d]/40 px-4 text-sm font-bold text-[#e8c57d] hover:bg-[#e8c57d]/10">{currentBillingType === "BOLETO" ? "Abrir boleto" : "Ver cobrança"}<ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
                  : <span className="text-xs leading-5 text-[#c9c0b2] sm:text-sm">{!paymentsEnabled ? "Pagamento temporariamente pausado" : preview ? "Cobrança ilustrativa" : unavailable ? "Fale com a barbearia" : "Aguardando disponibilização da cobrança"}</span>}
            </article>
          );
        })}</div> : <p className="p-5 text-sm leading-6 text-[#b9b1a4]">Suas cobranças aparecerão aqui após a confirmação dos dados e a emissão da mensalidade.</p>}
      </div>
    </section>
  );
}
