"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import FeedbackMessage from "@/components/FeedbackMessage";
import EmptyState from "@/components/ui/EmptyState";
import SummaryStatsPanel from "@/components/ui/SummaryStatsPanel";
import {
  EXTRA_CATEGORY_OPTIONS,
  getExtraCategoryLabel,
} from "@/lib/extraCategories";
import { prepareProductImageUpload } from "@/lib/productImageClient";
import { createExtraProductFromForm } from "@/app/actions/extraProductActions";
import ExtraProductCardClient from "./ExtraProductCardClient";

type ExtraItem = {
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

type AdminExtrasClientProps = {
  extras: ExtraItem[];
};

export default function AdminExtrasClient({ extras }: AdminExtrasClientProps) {
  const [feedback, setFeedback] = useState<{
    message: null | string;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();
  const [imageUpload, setImageUpload] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [newCommissionType, setNewCommissionType] = useState("PERCENT");

  useEffect(() => {
    return () => {
      if (imageUpload?.previewUrl) {
        URL.revokeObjectURL(imageUpload.previewUrl);
      }
    };
  }, [imageUpload]);

  const activeExtras = extras.filter((extra) => extra.isActive).length;
  const lowStockExtras = extras.filter((extra) => extra.stock > 0 && extra.stock <= 3).length;
  const outOfStockExtras = extras.filter((extra) => extra.stock === 0).length;

  return (
    <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
      <SummaryStatsPanel
        title="Resumo dos extras"
        description="Situação dos itens vendidos junto ao atendimento."
        stats={[
          {
            label: "Extras ativos",
            value: activeExtras,
            helper: "Liberados no agendamento",
          },
          {
            label: "Estoque baixo",
            value: lowStockExtras,
            helper: "3 unidades ou menos",
            tone: "warning",
          },
          {
            label: "Sem estoque",
            value: outOfStockExtras,
            helper: "Indisponíveis agora",
            tone: "danger",
          },
        ]}
      />

      <section className="dashboard-subpanel p-3.5 sm:p-5">
        <form
          className="space-y-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);

            if (imageUpload) {
              formData.set("image", imageUpload.file);
            }

            startTransition(async () => {
              try {
                await createExtraProductFromForm(formData);
                setFeedback({
                  message: "Extra cadastrado com sucesso.",
                  tone: "success",
                });
                setImageUpload((current) => {
                  if (current?.previewUrl) {
                    URL.revokeObjectURL(current.previewUrl);
                  }
                  return null;
                });
                form.reset();
                setNewCommissionType("PERCENT");
              } catch (error) {
                setFeedback({
                  message:
                    error instanceof Error
                      ? error.message
                      : "Não foi possível cadastrar o extra.",
                  tone: "error",
                });
              }
            });
          }}
        >
          <FeedbackMessage message={feedback.message} tone={feedback.tone} />

          <div className="grid gap-3 md:grid-cols-[1fr_13rem] md:items-end">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Cadastro
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Novo extra</h2>
            </div>

            {imageUpload ? (
              <div className="grid grid-cols-[3.5rem_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-2">
                <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-black/20">
                  <Image
                    src={imageUpload.previewUrl}
                    alt="Preview do extra"
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <p className="truncate text-xs font-semibold text-zinc-300">
                  Imagem pronta
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_13rem]">
            <Field label="Nome">
              <input
                name="name"
                required
                maxLength={120}
                className="service-edit-control"
                placeholder="Ex.: Água sem gás"
              />
            </Field>

            <Field label="Categoria">
              <select
                name="category"
                defaultValue="OTHER"
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

          <input type="hidden" name="description" value="" />

          <div className="service-edit-row service-edit-row-extra">
            <Field label="Preço">
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                className="service-edit-control"
                placeholder="0.00"
              />
            </Field>

            <Field label="Estoque">
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                required
                className="service-edit-control"
                placeholder="0"
              />
            </Field>

            <Field label="Tipo">
              <select
                name="commissionType"
                value={newCommissionType}
                onChange={(event) => setNewCommissionType(event.target.value)}
                className="service-edit-control"
              >
                <option value="PERCENT">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </Field>

            <Field label="Comissão">
              <div className="input-with-suffix">
                <input
                  name="commissionValue"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  required
                  className="service-edit-control input-with-suffix-control"
                  placeholder="0"
                />
                <span className="input-suffix">
                  {newCommissionType === "FIXED" ? "R$" : "%"}
                </span>
              </div>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Imagem opcional">
              <input
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
                className="max-w-full text-sm text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:text-white"
              />
            </Field>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full sm:w-auto"
            >
              {isPending ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </section>

      <section className="border-t border-white/10 pt-5">
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            Itens
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">Lista de extras</h2>
        </div>

        {extras.length === 0 ? (
          <EmptyState
            title="Nenhum extra cadastrado"
            description="Cadastre o primeiro item vendido junto ao atendimento."
          />
        ) : (
          <div className="space-y-2.5">
            {extras.map((extra) => (
              <ExtraProductCardClient key={extra.id} extra={extra} />
            ))}
          </div>
        )}
      </section>
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
