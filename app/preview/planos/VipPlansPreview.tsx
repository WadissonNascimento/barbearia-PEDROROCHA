"use client";

import { useState } from "react";
import { Crown, Scissors } from "lucide-react";
import VipPaymentsPanel from "@/app/planos/VipPaymentsPanel";

const scenarios = [
  { id: "paused", label: "Pagamentos pausados", method: "CREDIT_CARD", required: true, paid: true, enabled: false, due: "2026-10-06", day: 5 },
  { id: "update", label: "Atualização obrigatória", method: "CREDIT_CARD", required: true, paid: true, enabled: true, due: "2026-10-06", day: 5 },
  { id: "card", label: "Trocar cartão", method: "CREDIT_CARD", required: false, paid: true, enabled: true, due: "2026-10-06", day: 5 },
  { id: "pix", label: "Pagamento Pix", method: "PIX", required: false, paid: false, enabled: true, due: "2026-09-16", day: 16 },
  { id: "boleto", label: "Pagamento boleto", method: "BOLETO", required: false, paid: false, enabled: true, due: "2026-09-20", day: 20 },
];

export default function VipPlansPreview() {
  const [selected, setSelected] = useState("paused");
  const scenario = scenarios.find(item => item.id === selected)!;
  return (
    <main className="min-h-screen bg-[#050504] px-4 py-6 text-[#f5efe3] sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <aside className="rounded-xl border border-sky-300/25 bg-sky-300/[0.07] p-4">
          <p className="text-sm font-bold text-sky-100">Prévia local · dados fictícios</p>
          <p className="mt-1 text-xs leading-5 text-sky-100/75">Explore os cenários abaixo. Os formulários simulam a confirmação somente nesta tela.</p>
          <div className="mt-3 flex flex-wrap gap-2">{scenarios.map(item => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`min-h-10 rounded-lg border px-3 text-xs font-bold ${selected === item.id ? "border-sky-200 bg-sky-200 text-slate-950" : "border-sky-200/25 text-sky-100"}`}>{item.label}</button>)}</div>
        </aside>
        <div className="overflow-hidden rounded-2xl border border-[#b8945f]/25 bg-[#0b0a09]">
          <header className="border-b border-[#b8945f]/15 bg-[linear-gradient(135deg,_rgba(184,148,95,0.18),_rgba(8,8,7,0.98))] p-5 sm:p-7">
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#e8c57d]"><Crown className="h-4 w-4" aria-hidden="true" />Área VIP</p>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">Olá, Cliente! Seu plano é Ouro.</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-[#c9c0b2]"><Scissors className="h-4 w-4" aria-hidden="true" />Corte + Sobrancelha + Barba · 4 usos mensais</p>
          </header>
          <div className="p-5 sm:p-7">
            <VipPaymentsPanel key={scenario.id} price={180} dueDay={scenario.day} nextDueDate={scenario.due} paymentStatusLabel={scenario.paid ? "Setembro está pago" : "Setembro em aberto"} paymentPaid={scenario.paid} cpfCnpj="" currentBillingType={scenario.method} requiresUpdate={scenario.required} paymentsEnabled={scenario.enabled} payments={[
              { id: "demo-current", cycleMonth: "2026-09", amount: 180, status: scenario.paid ? "PAID" : "PENDING", dueDate: `2026-09-${String(scenario.day).padStart(2, "0")}` },
              { id: "demo-previous", cycleMonth: "2026-08", amount: 180, status: "PAID", dueDate: "2026-08-05" },
            ]} preview />
          </div>
        </div>
      </div>
    </main>
  );
}
