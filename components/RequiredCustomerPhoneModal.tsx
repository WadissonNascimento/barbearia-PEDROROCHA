"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Phone } from "lucide-react";
import { completeCustomerPhoneAction } from "@/app/customer/complete-phone/actions";
import FeedbackMessage from "@/components/FeedbackMessage";
import PhoneInput from "@/components/ui/PhoneInput";
import { BRAZILIAN_PHONE_EXAMPLE } from "@/lib/phone";

export default function RequiredCustomerPhoneModal() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "info" });
  const [isPending, startTransition] = useTransition();

  function submitPhone(formData: FormData) {
    setFeedback({ message: null, tone: "info" });

    startTransition(async () => {
      const result = await completeCustomerPhoneAction(formData);
      setFeedback({ message: result.message, tone: result.tone });

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md">
      <form
        action={submitPhone}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,22,32,0.98),rgba(8,12,20,0.98))] text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
              <Phone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Cadastro
              </p>
              <h2 className="mt-1 text-xl font-bold">Informe seu telefone</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Para concluir seu acesso, salve um telefone de contato. Nao precisa
            confirmar por SMS.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <label className="block text-sm font-semibold text-zinc-200">
            Telefone
            <PhoneInput
              name="phone"
              required
              autoFocus
              placeholder={BRAZILIAN_PHONE_EXAMPLE}
              className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition focus:border-[var(--brand)]/70"
            />
          </label>

          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          <button
            type="submit"
            disabled={isPending}
            className="min-h-12 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-base font-bold text-white shadow-[0_18px_36px_rgba(14,165,233,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Salvar e continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
