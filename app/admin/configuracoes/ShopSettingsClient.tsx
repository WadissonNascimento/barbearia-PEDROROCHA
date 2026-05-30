"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import PhoneInput from "@/components/ui/PhoneInput";
import { formatBrazilianPhone } from "@/lib/phone";
import { updateAdminShopSettingsAction } from "./actions";

type ShopSettings = {
  whatsappNumber: string | null;
  instagramUrl: string | null;
  emailSettings: {
    replyToEmail: string | null;
  } | null;
};

type FeedbackState = {
  message: string | null;
  tone: "success" | "error" | "info";
};

export default function ShopSettingsClient({ shop }: { shop: ShopSettings }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>({
    message: null,
    tone: "success",
  });
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          const result = await updateAdminShopSettingsAction(formData);
          setFeedback({ message: result.message, tone: result.tone });

          if (result.ok) {
            router.refresh();
          }
        });
      }}
    >
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      <section className="dashboard-subpanel p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
            Contato
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">
            Dados publicos da barbearia
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            Estes dados aparecem no site, catalogo, WhatsApp e e-mails da
            barbearia.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="WhatsApp">
            <PhoneInput
              name="whatsappNumber"
              defaultValue={formatBrazilianPhone(shop.whatsappNumber)}
              className="form-control text-sm"
            />
          </Field>

          <Field label="E-mail">
            <input
              name="replyToEmail"
              type="email"
              maxLength={254}
              defaultValue={shop.emailSettings?.replyToEmail || ""}
              placeholder="contato@barbearia.com"
              className="form-control text-sm"
            />
          </Field>

          <Field label="Instagram">
            <input
              name="instagramUrl"
              maxLength={160}
              defaultValue={shop.instagramUrl || ""}
              placeholder="@perfil ou link completo"
              className="form-control text-sm"
            />
          </Field>
        </div>
      </section>

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "Salvando..." : "Salvar contato"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
