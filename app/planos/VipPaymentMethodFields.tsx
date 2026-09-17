"use client";

import { Barcode, CreditCard, QrCode } from "lucide-react";

export type VipBillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

export const VIP_PAYMENT_METHOD_LABELS: Record<VipBillingType, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
};

const methods = [
  { value: "PIX", title: "Pix", shortTitle: "Pix", description: "Pague a cobrança de cada mês", icon: QrCode },
  { value: "BOLETO", title: "Boleto", shortTitle: "Boleto", description: "Emita e pague até o vencimento", icon: Barcode },
  { value: "CREDIT_CARD", title: "Cartão de crédito", shortTitle: "Cartão", description: "Cobrança mensal automática", icon: CreditCard },
] as const;

export function normalizeVipBillingType(value?: string | null): VipBillingType | "" {
  return value === "PIX" || value === "BOLETO" || value === "CREDIT_CARD" ? value : "";
}

export default function VipPaymentMethodFields({
  value,
  onChange,
  disabled,
}: {
  value: VipBillingType | "";
  onChange: (value: VipBillingType) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-xs font-bold text-[#f5efe3] sm:mb-3 sm:text-sm">Como você quer pagar?</legend>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {methods.map(({ value: method, title, shortTitle, description, icon: Icon }) => (
          <label key={method} title={title} className={`relative flex min-h-[78px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center transition focus-within:ring-2 focus-within:ring-[#e8c57d] sm:min-h-0 sm:items-start sm:justify-start sm:gap-2 sm:p-4 sm:text-left ${value === method ? "border-[#e8c57d] bg-[#e8c57d]/10" : "border-white/15 bg-black/20 hover:border-white/35"}`}>
            <input type="radio" name="billingType" value={method} checked={value === method} onChange={() => onChange(method)} required className="sr-only" />
            <span className="min-w-0">
              <Icon className="mx-auto mb-1 h-5 w-5 text-[#e8c57d] sm:mx-0 sm:mb-2" aria-hidden="true" />
              <span className="block truncate text-xs font-bold text-[#f5efe3] sm:text-sm"><span className="sm:hidden">{shortTitle}</span><span className="hidden sm:inline">{title}</span></span>
              <span className="mt-1 hidden text-xs leading-5 text-[#b9b1a4] sm:block">{description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
