"use client";

/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  EXTRA_CATEGORY_OPTIONS,
  getExtraCategoryLabel,
} from "@/lib/extraCategories";
import { sanitizeTextInput } from "@/lib/inputSanitization";
import { prepareProductImageUpload } from "@/lib/productImageClient";
import {
  deleteExtraProduct,
  toggleExtraProduct,
  updateExtraProductFromForm,
  updateExtraProductImage,
} from "@/app/actions/extraProductActions";

type ExtraProductCardClientProps = {
  extra: {
    id: string;
    name: string;
    description: null | string;
    category: string;
    price: number;
    commissionType: string;
    commissionValue: number;
    isActive: boolean;
    stock: number;
    imageUrl: null | string;
  };
};

function formatCommission(type: string, value: string | number) {
  return type === "FIXED" ? `R$ ${value}` : `${value}%`;
}

export default function ExtraProductCardClient({ extra }: ExtraProductCardClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isActive, setIsActive] = useState(extra.isActive);
  const [imageUrl, setImageUrl] = useState(extra.imageUrl);
  const [draft, setDraft] = useState({
    name: extra.name,
    category: extra.category,
    price: extra.price.toFixed(2),
    commissionType: extra.commissionType || "PERCENT",
    commissionValue: extra.commissionValue.toFixed(2),
    stock: String(extra.stock),
  });
  const [imageUpload, setImageUpload] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    message: null | string;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [pendingKey, setPendingKey] = useState<null | string>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (imageUpload?.previewUrl) {
        URL.revokeObjectURL(imageUpload.previewUrl);
      }
    };
  }, [imageUpload]);

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
          message:
            error instanceof Error ? error.message : "Não foi possível atualizar o extra.",
          tone: "error",
        });
      } finally {
        setPendingKey(null);
      }
    });
  }

  const categoryLabel = getExtraCategoryLabel(draft.category);
  const stockNumber = Number(draft.stock);
  const visibleImage = imageUpload?.previewUrl || imageUrl;

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
        className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.035]"
      >
        <ExtraImage imageUrl={visibleImage} name={draft.name} compact />

        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">{draft.name}</p>
          <p className="mt-1 truncate text-sm leading-5 text-zinc-400">
            {categoryLabel}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-semibold leading-5 text-zinc-300">
            R$ {Number(draft.price || 0).toFixed(2)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge variant={isActive ? "success" : "neutral"}>
            {isActive ? "Ativo" : "Oculto"}
          </StatusBadge>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
              stockNumber === 0
                ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                : stockNumber <= 3
                ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                : "border-sky-400/30 bg-sky-500/10 text-sky-200"
            }`}
          >
            {draft.stock}
          </span>
          <span className="text-lg text-zinc-500">{isOpen ? "-" : "+"}</span>
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-white/10 px-3.5 pb-3.5 pt-3.5">
          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          {isEditing ? (
            <div className="mt-3 space-y-3">
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData();
                  formData.set("extraProductId", extra.id);
                  formData.set("name", sanitizeTextInput(draft.name, { maxLength: 120 }));
                  formData.set("description", extra.description || "");
                  formData.set("category", draft.category);
                  formData.set("price", draft.price);
                  formData.set("stock", draft.stock);
                  formData.set("commissionType", draft.commissionType);
                  formData.set("commissionValue", draft.commissionValue);

                  runAction(
                    "details",
                    () => updateExtraProductFromForm(formData),
                    "Extra atualizado com sucesso.",
                    () => setIsEditing(false)
                  );
                }}
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_13rem]">
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

                  <Field label="Categoria">
                    <select
                      value={draft.category}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, category: event.target.value }))
                      }
                      className="service-edit-control"
                    >
                      {EXTRA_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="service-edit-row service-edit-row-extra">
                  <Field label="Preço">
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

                  <Field label="Estoque">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.stock}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, stock: event.target.value }))
                      }
                      className="service-edit-control"
                    />
                  </Field>

                  <Field label="Tipo">
                    <select
                      value={draft.commissionType}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          commissionType: event.target.value,
                        }))
                      }
                      className="service-edit-control"
                    >
                      <option value="PERCENT">Percentual</option>
                      <option value="FIXED">Valor fixo</option>
                    </select>
                  </Field>

                  <Field label="Comissão">
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.commissionValue}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            commissionValue: event.target.value,
                          }))
                        }
                        className="service-edit-control input-with-suffix-control"
                      />
                      <span className="input-suffix">
                        {draft.commissionType === "FIXED" ? "R$" : "%"}
                      </span>
                    </div>
                  </Field>
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
                      onClick={() => setIsEditing(false)}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>

              <form
                className="rounded-2xl border border-white/10 bg-black/20 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);

                  if (!imageUpload) {
                    setFeedback({
                      message: "Selecione uma nova imagem para enviar.",
                      tone: "error",
                    });
                    return;
                  }

                  formData.set("image", imageUpload.file);

                  runAction(
                    "image",
                    () => updateExtraProductImage(formData),
                    "Imagem atualizada com sucesso."
                  );
                }}
              >
                <input type="hidden" name="extraProductId" value={extra.id} />

                <div className="grid grid-cols-[4rem_1fr] gap-3 sm:grid-cols-[4.5rem_1fr] sm:items-center">
                  <ExtraImage imageUrl={visibleImage} name={draft.name} />

                  <div className="min-w-0">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Imagem
                    </p>
                    <input
                      id={`extra-image-${extra.id}`}
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
                      className="sr-only"
                    />
                    <div className="grid gap-2">
                      <label
                        htmlFor={`extra-image-${extra.id}`}
                        className="btn-primary min-h-10 w-full cursor-pointer rounded-xl shadow-none"
                      >
                        Escolher imagem
                      </label>
                      <p className="truncate text-xs text-zinc-500">
                        {imageUpload?.file.name || "Nenhuma imagem selecionada"}
                      </p>
                      <button
                        type="submit"
                        disabled={isPending && pendingKey === "image"}
                        className="btn-secondary min-h-10 whitespace-nowrap"
                      >
                        {isPending && pendingKey === "image" ? "Enviando..." : "Trocar imagem"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPending && pendingKey === "toggle"}
                  onClick={() =>
                    runAction(
                      "toggle",
                      async () => {
                        const updatedExtra = await toggleExtraProduct(extra.id);
                        setIsActive(updatedExtra.isActive);
                      },
                      () => (isActive ? "Extra ocultado." : "Extra ativado.")
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
                        "Excluir extra? Se houver histórico, ele será apenas ocultado para preservar entregas."
                      )
                    ) {
                      return;
                    }

                    runAction(
                      "delete",
                      () => deleteExtraProduct(extra.id),
                      "Extra excluído com sucesso."
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
              <div className="grid grid-cols-3 gap-2 text-sm">
                <SummaryTile label="Preço" value={`R$ ${Number(draft.price || 0).toFixed(2)}`} />
                <SummaryTile label="Estoque" value={draft.stock} accent={stockNumber <= 3} />
                <SummaryTile
                  label="Comissão"
                  value={formatCommission(draft.commissionType, draft.commissionValue)}
                  accent
                />
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

function ExtraImage({
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
        compact ? "h-14 w-14" : "h-16 w-16"
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
            sizes={compact ? "56px" : "64px"}
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
  children: React.ReactNode;
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
