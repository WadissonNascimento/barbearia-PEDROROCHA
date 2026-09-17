export default function VipCreditCardFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-bold text-[#f5efe3] sm:col-span-2">
        Nome no cartão
        <input name="cardHolderName" autoComplete="cc-name" required maxLength={80} className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-[#f5efe3] sm:col-span-2">
        Número do cartão
        <input name="cardNumber" inputMode="numeric" autoComplete="cc-number" required maxLength={23} placeholder="0000 0000 0000 0000" className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-[#f5efe3]">
        Validade
        <input name="cardExpiry" inputMode="numeric" autoComplete="cc-exp" required maxLength={7} placeholder="MM/AAAA" className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-[#f5efe3]">
        Código de segurança
        <input name="cardCcv" type="password" inputMode="numeric" autoComplete="cc-csc" required maxLength={4} placeholder="CVV" className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-[#f5efe3]">
        CEP do titular
        <input name="postalCode" inputMode="numeric" autoComplete="postal-code" required maxLength={9} className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-[#f5efe3]">
        Número do endereço
        <input name="addressNumber" autoComplete="address-line2" required maxLength={20} className="min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-white outline-none focus:border-[#e8c57d]" />
      </label>
      <p className="text-xs leading-5 text-zinc-400 sm:col-span-2">
        Os dados do cartão são enviados com segurança ao Asaas e não ficam armazenados neste sistema.
      </p>
    </div>
  );
}
