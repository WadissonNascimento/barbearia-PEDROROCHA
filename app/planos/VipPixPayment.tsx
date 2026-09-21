"use client";

import { Check, Copy, QrCode } from "lucide-react";
import { useState } from "react";

export default function VipPixPayment({
  qrCode,
  copyPaste,
  amount,
}: {
  qrCode: string;
  copyPaste: string;
  amount: number;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPix() {
    await navigator.clipboard.writeText(copyPaste);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="w-full sm:max-w-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e8c57d]/40 px-4 text-sm font-bold text-[#e8c57d] hover:bg-[#e8c57d]/10"
      >
        <QrCode className="h-4 w-4" aria-hidden="true" />
        {open ? "Fechar Pix" : "Pagar com Pix"}
      </button>

      {open ? (
        <div className="mt-3 rounded-xl border border-[#e8c57d]/25 bg-black/35 p-3 text-center">
          <p className="text-sm font-black text-[#f8f3e7]">
            Pix de {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          {/* The image is supplied directly by the authenticated Asaas API. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${qrCode}`}
            alt="QR Code Pix desta mensalidade"
            className="mx-auto mt-3 h-52 w-52 rounded-lg bg-white p-2"
          />
          <button
            type="button"
            onClick={copyPix}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e8c57d] px-4 text-sm font-black text-[#17120a]"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? "Código copiado" : "Copiar Pix Copia e Cola"}
          </button>
          <p className="mt-2 text-[11px] leading-4 text-[#b9b1a4]">
            Abra o aplicativo do seu banco, use Pix Copia e Cola ou escaneie o QR Code.
          </p>
        </div>
      ) : null}
    </div>
  );
}
