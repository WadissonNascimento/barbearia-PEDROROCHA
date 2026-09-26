"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EXTRA_CATEGORY_OPTIONS } from "@/lib/extraCategories";
import { prepareProductImageUpload } from "@/lib/productImageClient";

export type ExtraItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  commissionType: string;
  commissionValue: number;
  isActive: boolean;
  stock: number;
  imageUrl: string | null;
};

export function ExtraProductFields({ extra }: { extra?: ExtraItem }) {
  const [commissionType, setCommissionType] = useState(extra?.commissionType || "PERCENT");
  return (
    <div className="grid grid-cols-2 gap-4">
      <input type="hidden" name="description" value={extra?.description || ""} />
      <Field label="Nome do extra" className="col-span-2">
        <input name="name" defaultValue={extra?.name} required maxLength={120} className="service-edit-control" placeholder="Ex.: Pomada para cabelo" />
      </Field>
      <Field label="Categoria" className="col-span-2">
        <select name="category" defaultValue={extra?.category || "OTHER"} className="service-edit-control">
          {EXTRA_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Field>
      <Field label="Preço (R$)">
        <input name="price" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={extra?.price} required className="service-edit-control" />
      </Field>
      <Field label="Estoque">
        <input name="stock" type="number" inputMode="numeric" min="0" step="1" defaultValue={extra?.stock} required className="service-edit-control" />
      </Field>
      <Field label="Tipo de comissão" className="col-span-2">
        <select name="commissionType" value={commissionType} onChange={(event) => setCommissionType(event.target.value)} className="service-edit-control">
          <option value="PERCENT">Percentual (%)</option>
          <option value="FIXED">Valor fixo (R$)</option>
        </select>
      </Field>
      <Field label={`Comissão (${commissionType === "FIXED" ? "R$" : "%"})`} className="col-span-2">
        <input name="commissionValue" type="number" inputMode="decimal" min="0" max={commissionType === "PERCENT" ? 100 : undefined} step="0.01" defaultValue={extra?.commissionValue ?? 0} required className="service-edit-control" />
      </Field>
    </div>
  );
}

export function ExtraImageInput({ onPrepared, onBusyChange, disabled = false }: {
  onPrepared: (file: File | null) => void;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current++; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <div className="space-y-3">
      <Field label="Imagem do produto">
        <input type="file" disabled={disabled || busy} accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="block min-h-12 w-full min-w-0 rounded-xl border border-white/10 p-2 text-sm text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-zinc-100"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            const id = ++requestId.current;
            setError(null);
            onPrepared(null);
            setPreview(null);
            if (!file) return;
            setBusy(true);
            onBusyChange(true);
            try {
              const prepared = await prepareProductImageUpload(file);
              if (id !== requestId.current) { URL.revokeObjectURL(prepared.previewUrl); return; }
              setPreview(prepared.previewUrl);
              onPrepared(prepared.file);
            } catch (error) {
              if (id !== requestId.current) return;
              input.value = "";
              setError(error instanceof Error ? error.message : "Não foi possível preparar a imagem.");
            } finally {
              if (id === requestId.current) { setBusy(false); onBusyChange(false); }
            }
          }} />
      </Field>
      {busy && <p role="status" className="text-sm text-zinc-400">Preparando imagem...</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {preview && <div className="flex items-center gap-3"><Image src={preview} width={72} height={72} unoptimized alt="Prévia da imagem escolhida" className="h-18 w-18 rounded-xl bg-white object-contain" /><p className="text-sm text-zinc-400">Imagem pronta para salvar.</p></div>}
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block min-w-0 ${className}`}><span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>{children}</label>;
}
