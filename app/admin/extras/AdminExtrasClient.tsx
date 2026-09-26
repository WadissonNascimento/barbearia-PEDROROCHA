"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import FeedbackMessage from "@/components/FeedbackMessage";
import { getExtraCategoryLabel } from "@/lib/extraCategories";
import { createExtraProductFromForm } from "@/app/actions/extraProductActions";
import ExtraProductCardClient from "./ExtraProductCardClient";
import { ExtraImageInput, ExtraProductFields, type ExtraItem } from "./ExtraProductFields";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default function AdminExtrasClient({ extras }: { extras: ExtraItem[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string | null; tone: "success" | "error" }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();
  const lock = useRef(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const activeCount = extras.filter((extra) => extra.isActive).length;
  const stockAlerts = extras.filter((extra) => extra.stock <= 3).length;
  const visibleExtras = extras.filter((extra) =>
    normalize(`${extra.name} ${getExtraCategoryLabel(extra.category)}`).includes(normalize(search.trim())) &&
    (filter === "all" || extra.isActive === (filter === "active"))
  );

  return (
    <div className="admin-extras mt-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-zinc-400">
          <p><span className="font-semibold text-white">{activeCount} {activeCount === 1 ? "ativo" : "ativos"}</span><span className="mx-2 text-zinc-600">·</span>{extras.length - activeCount} {extras.length - activeCount === 1 ? "inativo" : "inativos"}</p>
          {stockAlerts > 0 && <p className="text-amber-300">{stockAlerts} {stockAlerts === 1 ? "item com estoque baixo ou zerado" : "itens com estoque baixo ou zerado"}</p>}
        </div>
        <button type="button" disabled={isPending || imageBusy} aria-expanded={showCreate} aria-controls="new-extra-form" className="btn-primary gap-2" onClick={() => { setShowCreate(!showCreate); setImage(null); setFeedback({ message: null, tone: "success" }); }}>
          {showCreate ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}{showCreate ? "Fechar cadastro" : "Novo extra"}
        </button>
      </div>

      {showCreate && <section id="new-extra-form" className="rounded-2xl border border-white/15 bg-white/[0.035] p-4 sm:p-5">
        <h2 className="text-lg font-bold text-white">Novo extra</h2>
        <p className="mt-2 text-sm text-zinc-400">Cadastre um produto ou bebida para retirada no atendimento.</p>
        <form key={formVersion} className="mt-5 space-y-5" onSubmit={(event) => {
          event.preventDefault();
          if (lock.current || isPending || imageBusy) return;
          lock.current = true;
          setFeedback({ message: null, tone: "success" });
          const formData = new FormData(event.currentTarget);
          if (image) formData.set("image", image);
          startTransition(async () => {
            try {
              await createExtraProductFromForm(formData);
              setFeedback({ message: "Extra cadastrado com sucesso.", tone: "success" });
              setImage(null);
              setFormVersion((version) => version + 1);
              router.refresh();
            } catch (error) {
              setFeedback({ message: error instanceof Error ? error.message : "Não foi possível cadastrar o extra.", tone: "error" });
            } finally { lock.current = false; }
          });
        }}>
          <fieldset disabled={isPending} className="space-y-5">
            <ExtraProductFields />
            <div className="border-t border-white/10 pt-4"><ExtraImageInput onPrepared={setImage} onBusyChange={setImageBusy} /><p className="mt-2 text-xs text-zinc-500">Opcional. Você pode adicionar uma foto depois.</p></div>
            <button type="submit" disabled={isPending || imageBusy} className="btn-primary w-full sm:w-auto">{isPending ? "Cadastrando..." : "Cadastrar extra"}</button>
          </fieldset>
          <FeedbackMessage {...feedback} />
        </form>
      </section>}

      <div className="space-y-4">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-black/20 px-4 focus-within:border-white/40">
          <Search size={18} className="shrink-0 text-zinc-500" aria-hidden="true" /><span className="sr-only">Buscar extra</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou bebida" className="min-w-0 w-full bg-transparent py-3 text-base text-white outline-none placeholder:text-zinc-500" />
        </label>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1" aria-label="Filtrar extras">
          {([ ["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"] ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-lg px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${filter === value ? "bg-white/15 text-white shadow-sm" : "text-zinc-400 hover:text-white"}`}>{label}</button>
          ))}
        </div>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Produtos e bebidas <span className="ml-2 text-sm font-normal text-zinc-500">{visibleExtras.length}</span></h2>
        {visibleExtras.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-zinc-400">{extras.length ? "Nenhum extra encontrado com esses filtros." : "Cadastre seu primeiro extra para começar."}</p> : (
          <div className="grid items-start gap-3 lg:grid-cols-2">{visibleExtras.map((extra) => <ExtraProductCardClient key={extra.id} extra={extra} />)}</div>
        )}
      </section>
    </div>
  );
}
