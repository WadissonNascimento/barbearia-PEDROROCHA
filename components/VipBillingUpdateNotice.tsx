"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ShieldAlert } from "lucide-react";

export default function VipBillingUpdateNotice() {
  const pathname = usePathname() || "/";
  const isAccountAccessPage = [
    "/login",
    "/logout",
    "/register",
    "/cadastro",
    "/forgot-password",
    "/reset-password",
    "/auth",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isAccountAccessPage) return null;

  return (
    <section
      aria-labelledby="vip-billing-update-title"
      className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-6xl rounded-2xl border border-amber-200/30 bg-amber-200/[0.07] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
              Atualização obrigatória do seu plano
            </p>
            <h2 id="vip-billing-update-title" className="mt-1 text-base font-bold text-white">
              Confirme seus dados e como prefere pagar
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-300">
              Confira seu CPF e contato e escolha Pix, boleto ou cartão de crédito.
              Faça essa atualização para continuar agendando pelo plano, mesmo que
              já tenha cadastrado um cartão. Seu vencimento será respeitado.
            </p>
          </div>
        </div>
        <Link
          href="/planos#dados-pagamento"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f1e8d8] px-4 text-sm font-bold text-[#080807] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
        >
          Atualizar dados
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
