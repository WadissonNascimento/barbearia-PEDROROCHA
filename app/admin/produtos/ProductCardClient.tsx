"use client";

/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import StatusBadge from "@/components/ui/StatusBadge";
import { sanitizeTextInput } from "@/lib/inputSanitization";
import {
  prepareProductImageUpload,
  prepareSecondaryProductImageUpload,
} from "@/lib/productImageClient";
import {
  addProductSecondaryImageFromForm,
  deleteProduct,
  deleteProductSecondaryImage,
  toggleProduct,
  updateProductFromForm,
} from "@/app/actions/productActions";

const MAX_SECONDARY_IMAGES = 5;

function getProductActionErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Nao foi possivel atualizar a maquina.";

  if (message.toLowerCase().includes("unexpected response")) {
    return "Nao foi possivel salvar agora. Se estiver usando iPhone, aguarde a foto terminar de carregar no aparelho e tente enviar novamente.";
  }

  return message;
}

type PreparedImageUpload = {
  file: File;
  previewUrl: string;
};

type SecondaryProductImage = {
  id: string;
  url: string;
};

type ProductCardClientProps = {
  product: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    price: number;
    isActive: boolean;
    imageUrl: string | null;
    secondaryImages: SecondaryProductImage[];
  };
};

export default function ProductCardClient({ product }: ProductCardClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isActive, setIsActive] = useState(product.isActive);
  const [imageUrl, setImageUrl] = useState(product.imageUrl);
  const [secondaryImages, setSecondaryImages] = useState(product.secondaryImages);
  const [draft, setDraft] = useState({
    name: product.name,
    description: product.description || "",
    category: product.category,
    price: product.price.toFixed(2),
  });
  const [imageUpload, setImageUpload] = useState<PreparedImageUpload | null>(null);
  const [secondaryUploads, setSecondaryUploads] = useState<PreparedImageUpload[]>([]);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
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

  function runAction(
    key: string,
    action: () => Promise<void | { message?: string; deleted?: boolean; imageUrl?: string }>,
    successMessage: string | (() => string),
    onSuccess?: () => void
  ) {
    setPendingKey(key);

    startTransition(async () => {
      try {
        const actionResult = await action();

        if (actionResult?.deleted === false) {
          setIsActive(false);
          setImageUrl(null);
          setSecondaryImages([]);
        }

        if (actionResult?.imageUrl) {
          setImageUrl(actionResult.imageUrl);
          setImageUpload((current) => {
            if (current?.previewUrl) {
              URL.revokeObjectURL(current.previewUrl);
            }

            return null;
          });
        }

        setFeedback({
          message:
            actionResult?.message ||
            (typeof successMessage === "function" ? successMessage() : successMessage),
          tone: "success",
        });
        onSuccess?.();
        router.refresh();
      } catch (error) {
        setFeedback({
          message: getProductActionErrorMessage(error),
          tone: "error",
        });
      } finally {
        setUploadProgress(null);
        setPendingKey(null);
      }
    });
  }

  async function handleMainImageChange(event: ChangeEvent<HTMLInputElement>) {
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
          error instanceof Error ? error.message : "Nao foi possivel preparar a imagem.",
        tone: "error",
      });
    }
  }

  async function handleSecondaryImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    const availableSlots = MAX_SECONDARY_IMAGES - secondaryImages.length;

    if (files.length === 0) {
      clearSecondaryUploads();
      return;
    }

    if (files.length > availableSlots) {
      event.currentTarget.value = "";
      clearSecondaryUploads();
      setFeedback({
        message: `Voce ainda pode adicionar ${availableSlots} imagem(ns) secundaria(s).`,
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
            : "Nao foi possivel preparar as imagens secundarias.",
        tone: "error",
      });
    }
  }

  const visibleImage = imageUpload?.previewUrl || imageUrl;
  const secondaryCount = secondaryImages.length + secondaryUploads.length;
  const canAddSecondaryImages = secondaryImages.length < MAX_SECONDARY_IMAGES;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((current) => !current);
          if (isOpen) {
            setIsEditing(false);
          }
        }}
        className="grid w-full grid-cols-[5.5rem_1fr] items-center gap-3.5 px-4 py-4 text-left transition hover:bg-white/[0.035] sm:grid-cols-[6rem_1fr_auto]"
      >
        <ProductImage imageUrl={visibleImage} name={draft.name} compact />

        <div className="min-w-0">
          <p className="line-clamp-2 text-base font-semibold leading-5 text-white">
            {draft.name}
          </p>
          {draft.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
              {draft.description}
            </p>
          ) : null}
          <p className="mt-1 whitespace-nowrap text-sm font-semibold leading-5 text-zinc-300">
            R$ {Number(draft.price || 0).toFixed(2)}
          </p>
        </div>

        <div className="col-span-2 flex shrink-0 items-center justify-between gap-2 border-t border-white/10 pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
          <StatusBadge variant={isActive ? "success" : "neutral"}>
            {isActive ? "Ativo" : "Oculto"}
          </StatusBadge>
          <span className="text-lg text-zinc-500">{isOpen ? "-" : "+"}</span>
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-white/10 px-3.5 pb-3.5 pt-3.5">
          <FeedbackMessage message={feedback.message} tone={feedback.tone} />
          <FeedbackMessage message={uploadProgress} tone="info" />

          {isEditing ? (
            <div className="mt-3 space-y-3">
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData();
                  formData.set("productId", product.id);
                  formData.set("name", sanitizeTextInput(draft.name, { maxLength: 120 }));
                  formData.set(
                    "description",
                    sanitizeTextInput(draft.description, { maxLength: 360 })
                  );
                  formData.set("category", draft.category);
                  formData.set("price", draft.price);

                  if (imageUpload) {
                    formData.set("image", imageUpload.file);
                  }

                  runAction(
                    "details",
                    async () => {
                      await updateProductFromForm(formData);

                      const nextImages: SecondaryProductImage[] = [];

                      for (const [index, upload] of secondaryUploads.entries()) {
                        setUploadProgress(
                          `Enviando foto secundaria ${index + 1}/${secondaryUploads.length}...`
                        );
                        const imageFormData = new FormData();
                        imageFormData.set("productId", product.id);
                        imageFormData.set("secondaryImage", upload.file);
                        const result =
                          await addProductSecondaryImageFromForm(imageFormData);

                        if (!result.ok) {
                          throw new Error(result.message);
                        }

                        if (result.image) {
                          nextImages.push(result.image);
                        }
                      }

                      if (nextImages.length > 0) {
                        setSecondaryImages((current) => [
                          ...current,
                          ...nextImages,
                        ]);
                      }
                    },
                    "Maquina atualizada com sucesso.",
                    () => {
                      setIsEditing(false);
                      clearSecondaryUploads();
                    }
                  );
                }}
              >
                <Field label="Nome">
                  <input
                    value={draft.name}
                    maxLength={120}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    className="service-edit-control"
                  />
                </Field>

                <Field label="Descricao curta">
                  <textarea
                    value={draft.description}
                    maxLength={360}
                    rows={3}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Maquina profissional com acabamento preciso."
                    className="service-edit-control min-h-24 resize-y"
                  />
                </Field>

                <Field label="Preco">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.price}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, price: event.target.value }))
                    }
                    className="service-edit-control"
                  />
                </Field>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="grid grid-cols-[4rem_1fr] gap-3 sm:grid-cols-[4.5rem_1fr] sm:items-center">
                    <ProductImage imageUrl={visibleImage} name={draft.name} />

                    <div className="min-w-0">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                        Imagem principal de capa
                      </p>
                      <input
                        id={`product-image-${product.id}`}
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                        onChange={handleMainImageChange}
                        className="sr-only"
                      />
                      <div className="grid gap-2">
                        <label
                          htmlFor={`product-image-${product.id}`}
                          className="btn-primary min-h-10 w-full cursor-pointer rounded-xl shadow-none"
                        >
                          Escolher imagem
                        </label>
                        <p className="truncate text-xs text-zinc-500">
                          {imageUpload?.file.name || "Nenhuma nova imagem selecionada"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          A capa continua com tratamento de fundo automatico.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                        Fotos secundarias
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Fotos reais da maquina, ate 20MB cada, sem remocao de fundo.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300">
                      {secondaryCount}/{MAX_SECONDARY_IMAGES}
                    </span>
                  </div>

                  {secondaryImages.length > 0 || secondaryUploads.length > 0 ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {secondaryImages.map((image) => (
                        <div
                          key={image.id}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/25"
                        >
                          <Image
                            src={image.url}
                            alt={`Foto secundaria de ${draft.name}`}
                            fill
                            sizes="90px"
                            className="object-cover"
                          />
                          <button
                            type="button"
                            disabled={isPending && pendingKey === `secondary-${image.id}`}
                            onClick={() => {
                              const formData = new FormData();
                              formData.set("imageId", image.id);
                              runAction(
                                `secondary-${image.id}`,
                                () => deleteProductSecondaryImage(formData),
                                "Imagem removida.",
                                () =>
                                  setSecondaryImages((current) =>
                                    current.filter((item) => item.id !== image.id)
                                  )
                              );
                            }}
                            className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            X
                          </button>
                        </div>
                      ))}

                      {secondaryUploads.map((upload) => (
                        <div
                          key={upload.previewUrl}
                          className="relative aspect-square overflow-hidden rounded-xl border border-[var(--brand)]/40 bg-black/25"
                        >
                          <img
                            src={upload.previewUrl}
                            alt="Preview de foto secundaria"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {canAddSecondaryImages ? (
                    <div className="mt-3">
                      <input
                        id={`product-secondary-images-${product.id}`}
                        name="secondaryImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                        multiple
                        onChange={handleSecondaryImagesChange}
                        className="sr-only"
                      />
                      <label
                        htmlFor={`product-secondary-images-${product.id}`}
                        className="btn-secondary min-h-10 w-full cursor-pointer rounded-xl"
                      >
                        Adicionar fotos secundarias
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="service-action-stack">
                  <div className="service-action-row service-action-row-primary">
                    <button
                      type="submit"
                      disabled={isPending && pendingKey === "details"}
                      className="btn-primary"
                    >
                      {isPending && pendingKey === "details" ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        clearSecondaryUploads();
                      }}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>

              <div className="service-action-row service-action-row-danger">
                <button
                  type="button"
                  disabled={isPending && pendingKey === "toggle"}
                  onClick={() =>
                    runAction(
                      "toggle",
                      async () => {
                        const updatedProduct = await toggleProduct(product.id);
                        setIsActive(updatedProduct.isActive);
                      },
                      () => (isActive ? "Maquina ocultada." : "Maquina ativada.")
                    )
                  }
                  className={isActive ? "btn-warning-soft" : "btn-secondary"}
                >
                  {isPending && pendingKey === "toggle"
                    ? "Salvando..."
                    : isActive
                      ? "Ocultar"
                      : "Ativar"}
                </button>

                <button
                  type="button"
                  disabled={isPending && pendingKey === "delete"}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Excluir maquina do catalogo? Esta acao remove o item definitivamente."
                      )
                    ) {
                      return;
                    }

                    runAction(
                      "delete",
                      () => deleteProduct(product.id),
                      "Maquina excluida com sucesso."
                    );
                  }}
                  className="btn-danger"
                >
                  {isPending && pendingKey === "delete" ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="grid gap-2 text-sm">
                <SummaryTile label="Preco" value={`R$ ${Number(draft.price || 0).toFixed(2)}`} />
                <SummaryTile
                  label="Fotos secundarias"
                  value={`${secondaryImages.length}/${MAX_SECONDARY_IMAGES}`}
                />
                {draft.description ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                      Descricao
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-300">
                      {draft.description}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn-secondary"
                >
                  Editar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function ProductImage({
  imageUrl,
  name,
  compact = false,
}: {
  imageUrl: string | null;
  name: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl bg-black/20 ${
        compact ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16"
      }`}
    >
      {imageUrl ? (
        imageUrl.startsWith("blob:") ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes={compact ? "(max-width: 640px) 80px, 96px" : "64px"}
            className="object-cover"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
          Sem imagem
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-2.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-bold ${
          accent ? "text-[var(--brand-strong)]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
