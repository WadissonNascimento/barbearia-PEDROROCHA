"use client";

import { Barcode, CreditCard, QrCode } from "lucide-react";

export type VipBillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

export const VIP_PAYMENT_METHOD_LABELS: Record<VipBillingType, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
};

const methods = [
  { value: "PIX", title: "Pix", description: "Pague a cobrança de cada mês", icon: QrCode },
  { value: "BOLETO", title: "Boleto", description: "Emita e pague até o vencimento", icon: Barcode },
  { value: "CREDIT_CARD", title: "Cartão de crédito", description: "Cobrança mensal automática", icon: CreditCard },
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
      <legend className="mb-3 text-sm font-bold text-[#f5efe3]">Como você quer pagar seu plano?</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {methods.map(({ value: method, title, description, icon: Icon }) => (
          <label key={method} className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-[#e8c57d] ${value === method ? "border-[#e8c57d] bg-[#e8c57d]/10" : "border-white/15 bg-black/20 hover:border-white/35"}`}>
            <input type="radio" name="billingType" value={method} checked={value === method} onChange={() => onChange(method)} required className="mt-1 h-4 w-4 shrink-0 accent-[#e8c57d]" />
            <span className="min-w-0">
              <Icon className="mb-2 h-5 w-5 text-[#e8c57d]" aria-hidden="true" />
              <span className="block text-sm font-bold text-[#f5efe3]">{title}</span>
              <span className="mt-1 block text-xs leading-5 text-[#b9b1a4]">{description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
