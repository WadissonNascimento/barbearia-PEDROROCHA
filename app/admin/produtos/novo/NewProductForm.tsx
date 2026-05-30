"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import {
  addProductSecondaryImageFromForm,
  createProductFromForm,
} from "@/app/actions/productActions";
import {
  prepareProductImageUpload,
  prepareSecondaryProductImageUpload,
} from "@/lib/productImageClient";

const MAX_SECONDARY_IMAGES = 5;

function getProductActionErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Nao foi possivel criar a maquina.";

  if (message.toLowerCase().includes("unexpected response")) {
    return "Nao foi possivel salvar agora. Se estiver usando iPhone, aguarde a foto terminar de carregar no aparelho e tente enviar novamente.";
  }

  return message;
}

type PreparedImageUpload = {
  file: File;
  previewUrl: string;
};

export default function NewProductForm() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [imageUpload, setImageUpload] = useState<PreparedImageUpload | null>(null);
  const [secondaryUploads, setSecondaryUploads] = useState<PreparedImageUpload[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (imageUpload?.previewUrl) {
        URL.revokeObjectURL(imageUpload.previewUrl);
      }

      for (const upload of secondaryUploads) {
        URL.revokeObjectURL(upload.previewUrl);
      }
    };
  }, [imageUpload, secondaryUploads]);

  function clearSecondaryUploads() {
    setSecondaryUploads((current) => {
      for (const upload of current) {
        URL.revokeObjectURL(upload.previewUrl);
      }

      return [];
    });
  }

  return (
    <form
      className="mt-5 space-y-3.5 border-t border-white/10 pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        startTransition(async () => {
          try {
            if (imageUpload) {
              formData.set("image", imageUpload.file);
            }
            formData.delete("secondaryImages");
            const product = await createProductFromForm(formData);

            for (const [index, upload] of secondaryUploads.entries()) {
              setUploadProgress(
                `Enviando foto secundaria ${index + 1}/${secondaryUploads.length}...`
              );
              const imageFormData = new FormData();
              imageFormData.set("productId", product.id);
              imageFormData.set("secondaryImage", upload.file);
              const result = await addProductSecondaryImageFromForm(imageFormData);

              if (!result.ok) {
                throw new Error(result.message);
              }
            }

            setUploadProgress(null);
            setFeedback({
              message: "Maquina criada com sucesso. Abrindo a lista...",
              tone: "success",
            });
            router.push("/admin/maquinas");
            router.refresh();
          } catch (error) {
            setUploadProgress(null);
            setFeedback({
              message: getProductActionErrorMessage(error),
              tone: "error",
            });
          }
        });
      }}
    >
      <FeedbackMessage message={feedback.message} tone={feedback.tone} />
      <FeedbackMessage message={uploadProgress} tone="info" />

      <input type="hidden" name="category" value="SHELF" />

      <label className="block min-w-0">
        <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          Nome
        </span>
        <input
          name="name"
          placeholder="Ex.: Pomada modeladora"
          maxLength={120}
          className="service-edit-control"
          required
        />
      </label>

      <label className="block min-w-0">
        <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          Descricao curta
        </span>
        <textarea
          name="description"
          placeholder="Ex.: Maquina profissional com acabamento preciso."
          maxLength={360}
          rows={3}
          className="service-edit-control min-h-24 resize-y"
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          Texto curto para aparecer no catalogo e no detalhe da maquina.
        </p>
      </label>

      <div className="grid gap-3">
        <label className="block min-w-0">
          <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Preço
          </span>
          <input
            name="price"
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            className="service-edit-control"
            required
          />
        </label>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_7rem] sm:items-start">
        <label className="block min-w-0">
          <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Imagem principal de capa
          </span>
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];

              if (!file) {
                setImageUpload(null);
                return;
              }

              try {
                const prepared = await prepareProductImageUpload(file);
                setImageUpload((current) => {
                  if (current?.previewUrl) {
                    URL.revokeObjectURL(current.previewUrl);
                  }

                  return prepared;
                });
                setFeedback({ message: null, tone: "success" });
              } catch (error) {
                event.currentTarget.value = "";
                setImageUpload(null);
                setFeedback({
                  message:
                    error instanceof Error
                      ? error.message
                      : "Não foi possível preparar a imagem.",
                  tone: "error",
                });
              }
            }}
            className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:text-white"
          />
          <p className="mt-2 text-xs text-zinc-500">
            JPG, PNG, WEBP ou HEIC. O sistema converte e compacta automaticamente.
          </p>
        </label>

        {imageUpload ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-[#edf1f7]">
            <div className="pointer-events-none absolute inset-[5%] rounded-[18px] border border-black/8" />
            <img
              src={imageUpload.previewUrl}
              loading="lazy"
              decoding="async"
              alt="Preview da maquina"
              className="h-full w-full object-contain"
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Fotos secundarias
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Ate 5 fotos reais da maquina, com ate 20MB cada. Elas nao passam por remocao de fundo.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300">
            {secondaryUploads.length}/{MAX_SECONDARY_IMAGES}
          </span>
        </div>

        {secondaryUploads.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {secondaryUploads.map((upload) => (
              <div
                key={upload.previewUrl}
                className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/25"
              >
                <img
                  src={upload.previewUrl}
                  loading="lazy"
                  decoding="async"
                  alt="Preview de foto secundaria"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}

        <input
          id="new-product-secondary-images"
          name="secondaryImages"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          onChange={async (event) => {
            const files = Array.from(event.currentTarget.files || []);

            if (files.length === 0) {
              clearSecondaryUploads();
              return;
            }

            if (files.length > MAX_SECONDARY_IMAGES) {
              event.currentTarget.value = "";
              clearSecondaryUploads();
              setFeedback({
                message: "Escolha no maximo 5 fotos secundarias.",
                tone: "error",
              });
              return;
            }

            try {
              const prepared = await Promise.all(
                files.map((file) => prepareSecondaryProductImageUpload(file))
              );
              clearSecondaryUploads();
              setSecondaryUploads(prepared);
              setFeedback({ message: null, tone: "success" });
            } catch (error) {
              event.currentTarget.value = "";
              clearSecondaryUploads();
              setFeedback({
                message:
                  error instanceof Error
                    ? error.message
                    : "Nao foi possivel preparar as fotos secundarias.",
                tone: "error",
              });
            }
          }}
          className="sr-only"
        />
        <label
          htmlFor="new-product-secondary-images"
          className="btn-secondary min-h-10 w-full cursor-pointer rounded-xl"
        >
          Escolher fotos secundarias
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full"
      >
        {isPending ? uploadProgress || "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
