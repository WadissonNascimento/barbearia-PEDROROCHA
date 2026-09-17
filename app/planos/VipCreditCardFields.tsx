export default function VipCreditCardFields() {
  const inputClass = "min-h-11 min-w-0 rounded-lg border border-white/15 bg-black/30 px-3 text-base text-white outline-none transition focus:border-[#e8c57d] sm:text-sm";
  const labelClass = "grid min-w-0 gap-1.5 text-xs font-bold text-[#f5efe3] sm:gap-2 sm:text-sm";

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:gap-3">
      <label className={`${labelClass} col-span-2`}>
        Nome no cartão
        <input name="cardHolderName" autoComplete="cc-name" required maxLength={80} className={inputClass} />
      </label>
      <label className={`${labelClass} col-span-2`}>
        Número do cartão
        <input name="cardNumber" inputMode="numeric" autoComplete="cc-number" required maxLength={23} placeholder="0000 0000 0000 0000" className={inputClass} />
      </label>
      <label className={labelClass}>
        Validade
        <input name="cardExpiry" inputMode="numeric" autoComplete="cc-exp" required maxLength={7} placeholder="MM/AAAA" className={inputClass} />
      </label>
      <label className={labelClass}>
        Código (CVV)
        <input name="cardCcv" type="password" inputMode="numeric" autoComplete="cc-csc" required maxLength={4} placeholder="123" className={inputClass} />
      </label>
      <label className={labelClass}>
        CEP
        <input name="postalCode" inputMode="numeric" autoComplete="postal-code" required maxLength={9} placeholder="00000-000" className={inputClass} />
      </label>
      <label className={labelClass}>
        Nº do endereço
        <input name="addressNumber" inputMode="numeric" autoComplete="address-line2" required maxLength={20} placeholder="123" className={inputClass} />
      </label>
      <p className="col-span-2 text-[11px] leading-4 text-zinc-400 sm:text-xs sm:leading-5">
        Envio seguro ao Asaas. Os dados do cartão não ficam salvos neste sistema.
      </p>
    </div>
  );
}
