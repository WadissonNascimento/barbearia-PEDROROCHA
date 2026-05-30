"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Power, Trash2, X } from "lucide-react";
import BarberPhotoUploader from "@/components/BarberPhotoUploader";
import FeedbackMessage from "@/components/FeedbackMessage";
import BackLink from "@/components/ui/BackLink";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatBrazilianPhone } from "@/lib/phone";
import { formatCurrency } from "@/lib/utils";
import {
  deleteBarberAction,
  toggleBarberStatusAction,
  updateBarberPhotoAction,
} from "../actions";

type BarberProfileClientProps = {
  barber: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
    isActive: boolean;
    appointmentsCount: number;
  };
  summary: {
    todayAppointments: number;
    weekPayout: number;
    servicesCount: number;
  };
};

export default function BarberProfileClient({
  barber,
  summary,
}: BarberProfileClientProps) {
  const baseHref = `/admin/barbeiros/${barber.id}`;
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<
    "deactivate" | "delete" | null
  >(null);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();

  function runProfileAction(actionType: "deactivate" | "delete") {
    const formData = new FormData();
    formData.set("barberId", barber.id);

    if (actionType === "deactivate") {
      formData.set("currentActive", String(barber.isActive));
    }

    startTransition(async () => {
      const result =
        actionType === "delete"
          ? await deleteBarberAction(formData)
          : await toggleBarberStatusAction(formData);

      setFeedback({ message: result.message, tone: result.tone });
      setConfirmAction(null);

      if (result.ok) {
        if (actionType === "delete") {
          router.push("/admin/barbeiros");
        } else {
          router.refresh();
        }
      }
    });
  }

  return (
    <div className="space-y-8">
      <SectionCard
        title="Perfil do barbeiro"
        description="Dados, foto e comissões individuais."
        className="overflow-hidden rounded-[30px] border border-[var(--brand)]/20 bg-[linear-gradient(180deg,var(--panel-bg-strong),rgba(9,12,20,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
        actions={
          <BackLink
            href="/admin/barbeiros"
            area="Equipe"
            className="w-full sm:w-auto"
          />
        }
      >
        <FeedbackMessage message={feedback.message} tone={feedback.tone} />

        <div className="mb-5 border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Equipe
          </p>
          <h3 className="mt-2 text-2xl font-black text-white">
            {barber.name || "Barbeiro"}
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge variant={barber.isActive ? "success" : "danger"}>
                {barber.isActive ? "Ativo" : "Desligado"}
              </StatusBadge>
              <StatusBadge variant="info">
                {barber.appointmentsCount} agendamento(s)
              </StatusBadge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  E-mail
                </p>
                <p className="mt-2 break-all text-sm text-zinc-200">
                  {barber.email || "Não informado"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Telefone
                </p>
                <p className="mt-2 text-sm text-zinc-200">
                  {formatBrazilianPhone(barber.phone) || "Não informado"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/20 p-3">
            <BarberPhotoUploader
              action={updateBarberPhotoAction}
              barberId={barber.id}
              currentImage={barber.image}
              name={barber.name || "Barbeiro"}
              compact
              embedded
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction("delete")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/15"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("deactivate")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-500/15"
              >
                <Power className="h-4 w-4" />
                {barber.isActive ? "Desativar" : "Reativar"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
            Ações do perfil
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ProfileMenuCard
              href={`${baseHref}/agendamentos-hoje`}
              label="Agendamentos de hoje"
              value={`${summary.todayAppointments}`}
              helper="Ver horários do dia"
            />
            <ProfileMenuCard
              href={`${baseHref}/repasse-semana`}
              label="Repasse da semana atual"
              value={formatCurrency(summary.weekPayout)}
              helper="Serviços e extras concluídos na semana"
            />
            <ProfileMenuCard
              href={`${baseHref}/servicos`}
              label="Serviços"
              value={`${summary.servicesCount}`}
              helper="Editar comissões individuais"
            />
            <ProfileMenuCard
              href={`${baseHref}/disponibilidade`}
              label="Disponibilidade"
              value="Agenda"
              helper="Editar horários e bloqueios"
            />
          </div>
        </div>
      </SectionCard>

      {confirmAction ? (
        <ProfileConfirmDialog
          actionType={confirmAction}
          barberName={barber.name || "Barbeiro"}
          isPending={isPending}
          isActive={barber.isActive}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => runProfileAction(confirmAction)}
        />
      ) : null}
    </div>
  );
}

function ProfileConfirmDialog({
  actionType,
  barberName,
  isPending,
  isActive,
  onCancel,
  onConfirm,
}: {
  actionType: "deactivate" | "delete";
  barberName: string;
  isPending: boolean;
  isActive: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const isDelete = actionType === "delete";
  const title = isDelete
    ? `Excluir ${barberName} da equipe?`
    : isActive
      ? `Desativar ${barberName}?`
      : `Reativar ${barberName}?`;
  const description = isDelete
    ? "Ele some da equipe e nao podera receber novos agendamentos. Os agendamentos antigos continuam salvos no historico."
    : isActive
      ? "Ele continuara aparecendo na equipe, mas ficara indisponivel para novos agendamentos."
      : "Ele voltara a aparecer como ativo e podera receber novos agendamentos.";

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/80 px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#070d18] text-white shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Confirmar acao
            </p>
            <h2 className="mt-2 text-2xl font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:bg-white/10 disabled:opacity-60"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-2 p-5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDelete
                ? "bg-red-500 hover:bg-red-400"
                : "bg-amber-500 hover:bg-amber-400"
            }`}
          >
            {isPending
              ? "Processando..."
              : isDelete
                ? "Sim, excluir"
                : isActive
                  ? "Sim, desativar"
                  : "Sim, reativar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="min-h-12 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/5 disabled:opacity-60"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProfileMenuCard({
  href,
  label,
  value,
  helper,
}: {
  href: string;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[76px] items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[var(--brand)]/22 bg-black/20 px-3.5 py-3 outline-none transition hover:border-[var(--brand)]/55 hover:bg-[var(--brand-muted)] focus-visible:border-[var(--brand)]/70 focus-visible:ring-2 focus-visible:ring-[var(--brand)]/25"
      aria-label={`Abrir ${label}`}
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--brand)] opacity-70 transition group-hover:opacity-100" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-strong)]">
          {label}
        </p>
        <p className="mt-1 truncate text-lg font-bold text-white">{value}</p>
        <p className="mt-1 text-xs text-zinc-400">{helper}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-muted)] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand-strong)] transition group-hover:border-[var(--brand)]/60 group-hover:bg-[var(--brand-muted)]">
        Abrir
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
