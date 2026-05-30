"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import {
  removeHomeImageAction,
  reorderHomeImageAction,
  replaceHomeImageAction,
  uploadHomeImageAction,
} from "./actions";

const MAX_HOME_IMAGES = 5;
const MAX_HOME_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_HOME_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_HOME_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

function getExtension(fileName: string | undefined) {
  return String(fileName || "")
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();
}

type HomeImageItem = {
  id: string;
  imageUrl: string;
  position: number;
};

function validateHomeImageFile(file: File) {
  const extension = getExtension(file.name);

  if (
    !(
      (file.type && ALLOWED_HOME_IMAGE_TYPES.has(file.type)) ||
      (extension && ALLOWED_HOME_IMAGE_EXTENSIONS.has(extension))
    )
  ) {
    throw new Error("Envie uma imagem JPG, PNG, WEBP ou HEIC.");
  }

  if (file.size > MAX_HOME_IMAGE_SIZE) {
    throw new Error("A imagem deve ter no maximo 8MB.");
  }
}

export default function AdminHomeImagesClient({
  images,
}: {
  images: HomeImageItem[];
}) {
  const router = useRouter();
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "info" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canUpload = images.length < MAX_HOME_IMAGES;

  function runAction(
    key: string,
    action: () => Promise<{ message?: string } | void>,
    fallbackMessage: string,
    onSuccess?: () => void
  ) {
    setPendingKey(key);
    startTransition(async () => {
      try {
        const result = await action();
        setFeedback({
          message: result?.message || fallbackMessage,
          tone: "success",
        });
        onSuccess?.();
        router.refresh();
      } catch (error) {
        setFeedback({
          message:
            error instanceof Error
              ? error.message
              : "Nao foi possivel atualizar as fotos da home.",
          tone: "error",
        });
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      <section className="dashboard-subpanel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Galeria da home
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Fotos principais</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              A home usa estas fotos em ordem. Sem fotos cadastradas, as imagens
              padrao atuais continuam aparecendo.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white">
            {images.length}/{MAX_HOME_IMAGES} fotos
          </div>
        </div>

        <form
          ref={uploadFormRef}
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();

            if (!canUpload) {
              setFeedback({
                message: "A home pode ter no maximo 5 fotos ativas.",
                tone: "error",
              });
              return;
            }

            const form = event.currentTarget;
            const formData = new FormData(form);
            const file = formData.get("image");

            if (!(file instanceof File) || file.size === 0) {
              setFeedback({
                message: "Selecione uma imagem para enviar.",
                tone: "error",
              });
              return;
            }

            try {
              validateHomeImageFile(file);
            } catch (error) {
              setFeedback({
                message:
                  error instanceof Error
                    ? error.message
                    : "Imagem invalida.",
                tone: "error",
              });
              return;
            }

            runAction(
              "upload",
              () => uploadHomeImageAction(formData),
              "Foto enviada para a home.",
              () => form.reset()
            );
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-white">Enviar nova foto</span>
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              disabled={!canUpload || isPending}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200 file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--brand)] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="mt-2 block text-xs text-zinc-500">
              JPG, JPEG, PNG, WEBP ou HEIC ate 8MB.
            </span>
          </label>

          <button
            type="submit"
            disabled={!canUpload || isPending}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingKey === "upload" ? "Enviando..." : "Enviar foto"}
          </button>
        </form>
      </section>

      {images.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-zinc-400">
          Nenhuma foto personalizada cadastrada. A home segue usando as imagens
          padrao atuais.
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {images.map((image, index) => (
            <article
              key={image.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
            >
              <div className="relative aspect-[4/3] bg-black/30">
                <Image
                  src={image.imageUrl}
                  alt={`Foto ${index + 1} da home`}
                  fill
                  sizes="(max-width: 768px) 100vw, 420px"
                  className="object-cover"
                />
                <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  PosiÃ§Ã£o {index + 1}
                </span>
              </div>

              <div className="space-y-3 p-3.5">
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const formData = new FormData(form);
                    const file = formData.get("image");

                    if (!(file instanceof File) || file.size === 0) {
                      setFeedback({
                        message: "Selecione uma imagem para substituir.",
                        tone: "error",
                      });
                      return;
                    }

                    try {
                      validateHomeImageFile(file);
                    } catch (error) {
                      setFeedback({
                        message:
                          error instanceof Error
                            ? error.message
                            : "Imagem invalida.",
                        tone: "error",
                      });
                      return;
                    }

                    runAction(
                      `replace-${image.id}`,
                      () => replaceHomeImageAction(formData),
                      "Foto substituida com sucesso.",
                      () => form.reset()
                    );
                  }}
                >
                  <input type="hidden" name="imageId" value={image.id} />
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                    disabled={isPending}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-2xl border border-[var(--brand)]/35 bg-[var(--brand-muted)] px-4 py-2.5 text-sm font-bold text-[var(--brand-strong)] transition hover:bg-[var(--brand-muted)]/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingKey === `replace-${image.id}` ? "Substituindo..." : "Substituir"}
                  </button>
                </form>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={index === 0 || isPending}
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("imageId", image.id);
                      formData.set("direction", "up");
                      runAction(
                        `up-${image.id}`,
                        () => reorderHomeImageAction(formData),
                        "Ordem atualizada."
                      );
                    }}
                    className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    disabled={index === images.length - 1 || isPending}
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("imageId", image.id);
                      formData.set("direction", "down");
                      runAction(
                        `down-${image.id}`,
                        () => reorderHomeImageAction(formData),
                        "Ordem atualizada."
                      );
                    }}
                    className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Descer
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const formData = new FormData();
                    formData.set("imageId", image.id);
                    runAction(
                      `remove-${image.id}`,
                      () => removeHomeImageAction(formData),
                      "Foto removida da home."
                    );
                  }}
                  className="w-full rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingKey === `remove-${image.id}` ? "Removendo..." : "Remover foto"}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
