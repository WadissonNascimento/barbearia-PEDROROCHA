"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, Package, Pencil, X } from "lucide-react";
import FeedbackMessage from "@/components/FeedbackMessage";
import { getExtraCategoryLabel } from "@/lib/extraCategories";
import { deleteExtraProduct, toggleExtraProduct, updateExtraProductFromForm, updateExtraProductImage } from "@/app/actions/extraProductActions";
import { ExtraImageInput, ExtraProductFields, type ExtraItem } from "./ExtraProductFields";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ExtraProductCardClient({ extra }: { extra: ExtraItem }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [active, setActive] = useOptimistic(extra.isActive);
  const [image, setImage] = useState<File | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string | null; tone: "success" | "error" }>({ message: null, tone: "success" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lock = useRef(false);

  function closeEditor() { setIsEditing(false); setImage(null); }
  function runAction(key: string, action: () => Promise<void | { message?: string }>, successMessage: string, onSuccess?: () => void, onStart?: () => void) {
    if (lock.current || isPending || imageBusy) return;
    lock.current = true;
    setPendingKey(key);
    setFeedback({ message: null, tone: "success" });
    startTransition(async () => {
      onStart?.();
      try {
        const result = await action();
        setFeedback({ message: result?.message || successMessage, tone: "success" });
        onSuccess?.();
        router.refresh();
      } catch (error) {
        setFeedback({ message: error instanceof Error ? error.message : "Não foi possível atualizar o extra.", tone: "error" });
      } finally { lock.current = false; }
    });
  }

  return (
    <article className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${active ? "border-white/15 bg-white/[0.035]" : "border-white/10 bg-black/20"}`}>
      <div className="flex items-start gap-3">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-white">
          {extra.imageUrl ? <Image src={extra.imageUrl} alt={extra.name} fill sizes="72px" className="object-contain" /> : <div className="flex h-full items-center justify-center bg-zinc-900 text-zinc-500"><Package size={28} aria-label="Sem imagem" /></div>}
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs text-zinc-400">{getExtraCategoryLabel(extra.category)}</p>
          <h3 className={`break-words text-base font-semibold leading-6 ${active ? "text-white" : "text-zinc-400"}`}>{extra.name}</h3>
          <p className="mt-2 text-lg font-bold text-white">{money(extra.price)}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-zinc-500">Estoque</dt><dd className={`mt-1 font-medium ${extra.stock === 0 ? "text-rose-300" : extra.stock <= 3 ? "text-amber-300" : "text-zinc-200"}`}>{extra.stock} {extra.stock === 1 ? "unidade" : "unidades"}</dd></div>
        <div><dt className="text-zinc-500">Comissão</dt><dd className="mt-1 font-medium text-zinc-200">{extra.commissionType === "FIXED" ? money(extra.commissionValue) : `${extra.commissionValue.toLocaleString("pt-BR")}%`}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <button type="button" role="switch" aria-checked={active} aria-label={`Disponibilidade de ${extra.name}`} aria-busy={isPending && pendingKey === "toggle"} disabled={isPending || imageBusy}
          className="flex min-h-12 items-center gap-3 rounded-xl pr-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait"
          onClick={() => runAction("toggle", async () => { await toggleExtraProduct(extra.id, !active); }, active ? "Extra desativado." : "Extra ativado.", undefined, () => setActive(!active))}>
          <span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${active ? "bg-emerald-500" : "bg-zinc-700"}`}><span className={`h-5 w-5 rounded-full shadow transition-transform motion-reduce:transition-none ${active ? "translate-x-5 bg-white" : "bg-zinc-400"}`} /></span>
          <span className={active ? "text-emerald-300" : "text-zinc-400"}>{active ? "Ativo" : "Inativo"}</span>
        </button>
        <button type="button" disabled={isPending || imageBusy} aria-expanded={isEditing} aria-controls={`edit-extra-${extra.id}`} onClick={isEditing ? closeEditor : () => setIsEditing(true)} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          {isEditing ? <X size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}{isEditing ? "Fechar" : "Editar"}
        </button>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs leading-5 text-zinc-400" role="status">
        {isPending ? <><LoaderCircle size={13} className="animate-spin" aria-hidden="true" />{pendingKey === "image" ? "Enviando imagem..." : "Salvando..."}</> : feedback.tone === "success" && feedback.message ? <><Check size={13} className="text-emerald-400" aria-hidden="true" />{feedback.message}</> : !active ? "Oculto para novos agendamentos." : extra.stock === 0 ? "Reponha o estoque para liberar a venda." : "Disponível para retirada no atendimento."}
      </p>
      {feedback.tone === "error" && <div className="mt-3"><FeedbackMessage {...feedback} /></div>}
      {isEditing && <div id={`edit-extra-${extra.id}`} className="mt-5 space-y-5 border-t border-white/10 pt-5">
        <form onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("extraProductId", extra.id);
          runAction("details", () => updateExtraProductFromForm(formData), "Extra atualizado com sucesso.", closeEditor);
        }}>
          <fieldset disabled={isPending || imageBusy} className="space-y-5">
            <ExtraProductFields extra={extra} />
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={closeEditor} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{isPending && pendingKey === "details" ? "Salvando..." : "Salvar"}</button></div>
          </fieldset>
        </form>
        <form className="space-y-4 border-t border-white/10 pt-5" onSubmit={(event) => {
          event.preventDefault();
          if (!image) { setFeedback({ message: "Escolha uma imagem para enviar.", tone: "error" }); return; }
          const formData = new FormData();
          formData.set("extraProductId", extra.id);
          formData.set("image", image);
          runAction("image", async () => { await updateExtraProductImage(formData); }, "Imagem atualizada com sucesso.", () => { setImage(null); setImageVersion((version) => version + 1); });
        }}>
          <ExtraImageInput key={imageVersion} onPrepared={setImage} onBusyChange={setImageBusy} disabled={isPending} />
          <button type="submit" disabled={isPending || imageBusy || !image} className="btn-secondary w-full">{isPending && pendingKey === "image" ? "Enviando..." : "Salvar imagem"}</button>
        </form>
        <button type="button" disabled={isPending || imageBusy} className="min-h-11 w-full rounded-xl px-3 text-sm text-red-300 hover:bg-red-500/10" onClick={() => {
          if (!window.confirm("Excluir extra? Se houver histórico, ele será apenas ocultado para preservar entregas.")) return;
          runAction("delete", () => deleteExtraProduct(extra.id), "Extra excluído com sucesso.", closeEditor);
        }}>{isPending && pendingKey === "delete" ? "Excluindo..." : "Excluir extra"}</button>
      </div>}
    </article>
  );
}
