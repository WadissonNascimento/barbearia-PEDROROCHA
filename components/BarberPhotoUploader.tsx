"use client";

import Image from "next/image";
import { Camera, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import type { MutationResult } from "@/lib/mutationResult";

type BarberPhotoUploaderProps = {
  action: (
    formData: FormData
  ) => Promise<MutationResult | MutationResult<{ image: string }>>;
  barberId?: string;
  currentImage: string | null;
  name: string;
  compact?: boolean;
  embedded?: boolean;
};

export default function BarberPhotoUploader({
  action,
  barberId,
  currentImage,
  name,
  compact = false,
  embedded = false,
}: BarberPhotoUploaderProps) {
  const [image, setImage] = useState(currentImage);
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error" | "info">("success");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const localImage = image?.startsWith("/") ? image : null;

  function submitPhoto(file: File | undefined) {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("photo", file);

    if (barberId) {
      formData.set("barberId", barberId);
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await action(formData);
      const data = result.data as { image?: string } | undefined;
      setFeedback(result.message);
      setTone(result.tone);

      if (result.ok && data?.image) {
        setImage(data.image);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    });
  }

  return (
    <div
      className={
        embedded
          ? "flex items-center justify-between gap-3 border-b border-white/10 pb-4"
          : compact
          ? "flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-black/20 p-3"
          : "rounded-2xl border border-white/10 bg-black/20 p-4"
      }
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (localImage) {
              setIsExpanded(true);
            }
          }}
          disabled={!localImage}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] text-sm font-bold text-[var(--brand-strong)] transition hover:border-[var(--brand)]/50 disabled:cursor-default"
          aria-label={localImage ? "Ampliar foto do barbeiro" : "Foto do barbeiro"}
        >
          {localImage ? (
            <Image
              src={localImage}
              alt={name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </button>

        <div className="min-w-0">
          {!compact ? (
            <>
              <p className="text-sm font-semibold text-white">Foto do barbeiro</p>
              <p className="mt-1 text-xs text-zinc-400">
                Aparece para os clientes no agendamento.
              </p>
            </>
          ) : (
            <p className="truncate text-sm font-medium text-zinc-200">Foto do perfil</p>
          )}

          {feedback ? (
            <p className={`mt-1 text-xs ${tone === "error" ? "text-red-300" : "text-[var(--brand-strong)]"}`}>
              {feedback}
            </p>
          ) : null}
        </div>
      </div>

      <label className={compact ? "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5" : "mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"}>
        <Camera aria-hidden="true" className="h-4 w-4" />
        {isPending ? "Enviando..." : "Trocar foto"}
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
          disabled={isPending}
          onChange={(event) => submitPhoto(event.currentTarget.files?.[0])}
          className="sr-only"
        />
      </label>

      {isExpanded && localImage ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada do barbeiro"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#050b16] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.7)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                  Foto do barbeiro
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar foto ampliada"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <Image
                src={localImage}
                alt={name}
                fill
                sizes="(max-width: 640px) 90vw, 420px"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
