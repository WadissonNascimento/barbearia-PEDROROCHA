"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import BarberPhotoUploader from "@/components/BarberPhotoUploader";
import FeedbackMessage from "@/components/FeedbackMessage";
import PhoneInput from "@/components/ui/PhoneInput";
import { formatBrazilianPhone } from "@/lib/phone";
import type { MutationResult } from "@/lib/mutationResult";

type BarberProfileSettingsProps = {
  photoAction: (
    formData: FormData
  ) => Promise<MutationResult | MutationResult<{ image: string }>>;
  contactAction: (formData: FormData) => Promise<MutationResult>;
  currentImage: string | null;
  name: string;
  email: string | null;
  phone: string | null;
};

export default function BarberProfileSettings({
  photoAction,
  contactAction,
  currentImage,
  name,
  email,
  phone,
}: BarberProfileSettingsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <BarberPhotoUploader
        action={photoAction}
        currentImage={currentImage}
        name={name}
        embedded
      />

      <div className="pt-4">
        <div className="min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Contato do barbeiro</p>
            <p className="mt-1 text-xs text-zinc-400">
              Atualize nome, e-mail e telefone do seu perfil.
            </p>
          </div>
        </div>

        {isEditing ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              startTransition(async () => {
                const result = await contactAction(formData);
                setFeedback({ message: result.message, tone: result.tone });

                if (result.ok) {
                  setIsEditing(false);
                  router.refresh();
                }
              });
            }}
          >
            <FeedbackMessage message={feedback.message} tone={feedback.tone} />

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                Nome
              </span>
              <input
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                defaultValue={name}
                className="form-control text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                E-mail
              </span>
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={email || ""}
                className="form-control text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                Telefone
              </span>
              <PhoneInput
                name="phone"
                defaultValue={formatBrazilianPhone(phone)}
                className="form-control text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full"
            >
              {isPending ? "Salvando..." : "Salvar contato"}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setFeedback({ message: null, tone: "success" });
                setIsEditing(false);
              }}
              className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-60"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <ProfileValue label="Nome" value={name || "Nao informado"} />
              <ProfileValue label="E-mail" value={email || "Nao informado"} />
              <ProfileValue
                label="Telefone"
                value={formatBrazilianPhone(phone) || "Nao informado"}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setFeedback({ message: null, tone: "success" });
                setIsEditing(true);
              }}
              className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              Editar contato
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
