"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, DollarSign, Pencil, Scissors, ShoppingBag } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import OperationalFeedbackDialog, {
  type OperationalFeedbackState,
} from "@/components/ui/OperationalFeedbackDialog";
import { editCompletedAdminFinanceAppointmentAction } from "@/app/admin/financeiro/actions";
import { editCompletedBarberFinanceAppointmentAction } from "@/app/barber/actions";
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  normalizeAppointmentStatus,
} from "@/lib/appointmentStatus";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import { formatScheduleDate, formatScheduleTime } from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";

export type FinanceAppointmentCardData = {
  id: string;
  publicId: number;
  date: Date;
  status: string;
  paymentMethod?: string | null;
  customerName: string;
  barberId?: string;
  barberName?: string;
  serviceName: string;
  notes: string | null;
  services: Array<{
    id: string;
    serviceId: string;
    name: string;
    price: number;
    payout: number;
  }>;
  items: Array<{
    id: string;
    extraProductId: string;
    name: string;
    quantity: number;
    subtotal: number;
    payout: number;
    isDelivered: boolean;
  }>;
  servicePayout: number;
  deliveredItemsPayout: number;
  payoutTotal: number;
  grossTotal: number;
};

export type FinanceEditServiceOption = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

export type FinanceEditExtraOption = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export default function FinanceAppointmentCard({
  appointment,
  services,
  extras,
  mode = "barber",
}: {
  appointment: FinanceAppointmentCardData;
  services: FinanceEditServiceOption[];
  extras: FinanceEditExtraOption[];
  mode?: "admin" | "barber";
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const muted = ["CANCELLED", "NO_SHOW"].includes(appointment.status);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => setIsExpanded((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setIsExpanded((current) => !current);
        }
      }}
      className="cursor-pointer overflow-hidden rounded-[22px] border border-white/10 bg-black/25 p-3.5 shadow-[0_18px_44px_rgba(0,0,0,0.16)] transition hover:border-[var(--brand)]/35 hover:bg-white/[0.035]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            {formatAppointmentPublicId(appointment.publicId)}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-[26px] font-black leading-none text-white">
              {formatScheduleTime(appointment.date)}
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              {formatScheduleDate(appointment.date, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
          <p className="mt-2 truncate text-base font-bold text-white">
            {appointment.customerName}
          </p>
          {appointment.barberName ? (
            <p className="mt-1 truncate text-xs font-semibold text-zinc-500">
              Barbeiro: {appointment.barberName}
            </p>
          ) : null}
          <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
            {appointment.serviceName || "Atendimento"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge
            variant={appointmentStatusVariant(appointment.status)}
            className="px-2.5 py-1 text-[10px]"
          >
            {appointmentStatusLabel(appointment.status)}
          </StatusBadge>
          {normalizeAppointmentStatus(appointment.status) === "COMPLETED" ? (
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">
              {paymentMethodLabel(appointment.paymentMethod)}
            </span>
          ) : null}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-emerald-300/70" />
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200/80">
              Repasse
            </p>
            <p className="mt-0.5 text-base font-black leading-none text-white">
              {formatCurrency(muted ? 0 : appointment.payoutTotal)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <BreakdownPill
          icon={<Scissors />}
          label="Serviços"
          value={formatCurrency(muted ? 0 : appointment.servicePayout)}
        />
        <BreakdownPill
          icon={<ShoppingBag />}
          label="Retiradas"
          value={formatCurrency(muted ? 0 : appointment.deliveredItemsPayout)}
        />
        <BreakdownPill
          icon={<DollarSign />}
          label="Vendido"
          value={formatCurrency(muted ? 0 : appointment.grossTotal)}
        />
      </div>

      {isExpanded ? (
        <div
          className="mt-3 space-y-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Serviços do atendimento
            </p>
            <div className="mt-2 space-y-1.5">
              {appointment.services.map((service) => (
                <FinanceLine
                  key={service.id}
                  label={service.name}
                  value={formatCurrency(service.payout)}
                  helper={`Valor cobrado: ${formatCurrency(service.price)}`}
                />
              ))}
            </div>
          </div>

          {appointment.items.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Itens retirados no local
              </p>
              <div className="mt-2 space-y-1.5">
                {appointment.items.map((item) => (
                  <FinanceLine
                    key={item.id}
                    label={`${item.name} x${item.quantity}`}
                    value={formatCurrency(item.isDelivered ? item.payout : 0)}
                    helper={
                      item.isDelivered
                        ? `Entregue - venda ${formatCurrency(item.subtotal)}`
                        : "Não entregue - não entra no repasse"
                    }
                    checked={item.isDelivered}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {services.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--brand)]/40 bg-[var(--brand-muted)] px-4 py-2 text-sm font-black text-white transition hover:border-[var(--brand)]/70 hover:brightness-110 sm:w-auto"
            >
              <Pencil className="h-4 w-4" />
              Editar itens do atendimento
            </button>
          ) : null}
        </div>
      ) : null}

      {isEditing ? (
        <FinanceEditAppointmentModal
          appointment={appointment}
          services={services}
          extras={extras}
          mode={mode}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
    </article>
  );
}

function FinanceEditAppointmentModal({
  appointment,
  services,
  extras,
  mode,
  onClose,
}: {
  appointment: FinanceAppointmentCardData;
  services: FinanceEditServiceOption[];
  extras: FinanceEditExtraOption[];
  mode: "admin" | "barber";
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const [dialogFeedback, setDialogFeedback] =
    useState<OperationalFeedbackState>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState(
    appointment.services.map((service) => service.serviceId)
  );
  const [selectedExtraIds, setSelectedExtraIds] = useState(
    appointment.items.map((item) => item.extraProductId)
  );
  const total = useMemo(() => {
    const serviceTotal = services
      .filter((service) => selectedServiceIds.includes(service.id))
      .reduce((sum, service) => sum + service.price, 0);
    const extrasTotal = extras
      .filter((extra) => selectedExtraIds.includes(extra.id))
      .reduce((sum, extra) => sum + extra.price, 0);

    return serviceTotal + extrasTotal;
  }, [extras, selectedExtraIds, selectedServiceIds, services]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  }

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((current) =>
      current.includes(extraId)
        ? current.filter((id) => id !== extraId)
        : [...current, extraId]
    );
  }

  function submitEdit(formData: FormData) {
    startTransition(async () => {
      try {
        const result =
          mode === "admin"
            ? await editCompletedAdminFinanceAppointmentAction(formData)
            : await editCompletedBarberFinanceAppointmentAction(formData);

        if (result.ok) {
          setDialogFeedback(null);
          onClose();
          router.refresh();
        } else {
          setDialogFeedback({
            title: "Nao foi possivel salvar",
            message: result.message,
            tone: "error",
          });
        }
      } catch {
        setDialogFeedback({
          title: "Erro ao salvar",
          message:
            "Nao foi possivel salvar as alteracoes agora. Confira sua conexao e tente novamente.",
          tone: "error",
        });
      }
    });
  }

  if (!isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center overflow-hidden overscroll-none bg-black/75 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <form
        action={submitEdit}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,22,32,0.98),rgba(8,12,20,0.98))] text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <input type="hidden" name="appointmentId" value={appointment.id} />

        <div className="border-b border-white/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                Financeiro
              </p>
              <h3 className="mt-2 text-xl font-bold">Editar itens concluidos</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Ajuste servicos e extras que entram no repasse.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="min-h-10 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Total atualizado
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {formatCurrency(total)}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Servicos
            </p>
            <div className="mt-2 grid gap-2">
              {services.map((service) => {
                const checked = selectedServiceIds.includes(service.id);

                return (
                  <label
                    key={service.id}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                      checked
                        ? "border-[var(--brand)]/70 bg-[var(--brand-muted)]"
                        : "border-white/10 bg-white/[0.035]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="serviceIds"
                      value={service.id}
                      checked={checked}
                      onChange={() => toggleService(service.id)}
                      className="h-5 w-5 shrink-0 accent-[var(--brand)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">
                        {service.name}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {service.duration} min - {formatCurrency(service.price)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Extras
            </p>
            <div className="mt-2 grid gap-2">
              {extras.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
                  Nenhum extra disponivel para ajuste.
                </p>
              ) : (
                extras.map((extra) => {
                  const checked = selectedExtraIds.includes(extra.id);

                  return (
                    <label
                      key={extra.id}
                      className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                        checked
                          ? "border-[var(--brand)]/70 bg-[var(--brand-muted)]"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="extraProductIds"
                        value={extra.id}
                        checked={checked}
                        onChange={() => toggleExtra(extra.id)}
                        className="h-5 w-5 shrink-0 accent-[var(--brand)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-white">
                          {extra.name}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {formatCurrency(extra.price)} - estoque {extra.stock}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <label className="block text-sm font-semibold text-zinc-200">
            Observacoes
            <textarea
              name="notes"
              rows={4}
              maxLength={400}
              defaultValue={appointment.notes || ""}
              className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-white outline-none transition focus:border-[var(--brand)]/70"
            />
          </label>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-400">Total</span>
            <strong className="text-lg tabular-nums text-white">
              {formatCurrency(total)}
            </strong>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="min-h-12 rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-12 rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>
      <OperationalFeedbackDialog
        feedback={dialogFeedback}
        onClose={() => setDialogFeedback(null)}
      />
    </div>,
    document.body
  );
}

function BreakdownPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        <span className="text-[var(--brand-strong)] [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function FinanceLine({
  label,
  value,
  helper,
  checked,
}: {
  label: string;
  value: string;
  helper: string;
  checked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {checked ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          ) : null}
          <p className="truncate text-sm font-bold text-white">{label}</p>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{helper}</p>
      </div>
      <p className="shrink-0 text-sm font-black text-[var(--brand-strong)]">
        {value}
      </p>
    </div>
  );
}
