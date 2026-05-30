"use client";

import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CalendarX2,
  ChevronDown,
  Clock3,
  ClipboardList,
  PencilLine,
  RotateCcw,
  Save,
  ShoppingBag,
  Trash2,
  UsersRound,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import DashboardShell from "@/components/ui/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackMessage from "@/components/FeedbackMessage";
import OperationalFeedbackDialog, {
  type OperationalFeedbackState,
} from "@/components/ui/OperationalFeedbackDialog";
import { getAppointmentItemsLabel } from "@/lib/appointmentItems";
import StatusBadge from "@/components/ui/StatusBadge";
import AdminWalkInAppointmentButton from "./AdminWalkInAppointmentButton";
import {
  getAppointmentDisplayName,
  getAppointmentGrandTotal,
} from "@/lib/appointmentServices";
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  normalizeAppointmentStatus,
} from "@/lib/appointmentStatus";
import {
  APPOINTMENT_PAYMENT_METHODS,
  paymentMethodLabel,
  type AppointmentPaymentMethod,
} from "@/lib/paymentMethods";
import {
  editAdminAppointmentAction,
  updateAdminAppointmentStatusAction,
} from "./actions";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import {
  formatScheduleDate,
  formatScheduleTime,
  getCurrentScheduleDateValue,
  getScheduleDateValue,
  getScheduleDayOfWeek,
} from "@/lib/scheduleTime";
import type { AgendaBlockItem } from "@/lib/agendaBlocks";
import {
  deleteAdminAgendaBlockAction,
  deleteAdminAgendaRecurringBlockAction,
  updateAdminAgendaBlockAction,
  updateAdminAgendaRecurringBlockAction,
} from "./actions";

export type AdminAgendaAppointment = {
  id: string;
  publicId: number;
  date: Date;
  status: string;
  paymentMethod: string | null;
  notes: string | null;
  barber: {
    id: string;
    name: string | null;
  };
  customer: {
    name: string | null;
    email: string | null;
  };
  services: Array<{
    serviceId: string;
    nameSnapshot: string;
    orderIndex: number;
    priceSnapshot: number;
  }>;
  items: Array<{
    extraProductId: string;
    productNameSnapshot: string;
    quantity: number;
    subtotal: number;
  }>;
};

export type AdminAgendaBarber = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type AdminAgendaService = {
  id: string;
  name: string;
  price: number;
  duration: number;
  barberId: string | null;
};

export type AdminAgendaExtra = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export type AdminAgendaBlock = AgendaBlockItem;
type BlockMutationAction = (formData: FormData) => Promise<{
  ok: boolean;
  message: string;
  tone: "success" | "error" | "info";
}>;

type AdminAgendaFilters = {
  dateFrom: string;
  dateTo: string;
  barberId?: string;
  q?: string;
};

export default function AdminAgendaClient({
  appointments,
  blocks,
  barbers,
  services,
  extras,
  initialFilters,
  isTruncated = false,
  limit = null,
}: {
  appointments: AdminAgendaAppointment[];
  blocks: AdminAgendaBlock[];
  barbers: AdminAgendaBarber[];
  services: AdminAgendaService[];
  extras: AdminAgendaExtra[];
  initialFilters: AdminAgendaFilters;
  isTruncated?: boolean;
  limit?: number | null;
}) {
  const router = useRouter();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [isFilterPending, startFilterTransition] = useTransition();
  const visibleAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        matchesAgendaFilters(appointment, appliedFilters)
      ),
    [appointments, appliedFilters]
  );
  const visibleBlocks = useMemo(
    () => blocks.filter((block) => matchesAgendaBlockFilters(block, appliedFilters)),
    [blocks, appliedFilters]
  );
  const visibleTimelineItems = useMemo(
    () =>
      [
        ...visibleAppointments.map((appointment) => ({
          type: "appointment" as const,
          id: appointment.id,
          sortTime: new Date(appointment.date).getTime(),
          appointment,
        })),
        ...visibleBlocks.map((block) => ({
          type: "block" as const,
          id: block.id,
          sortTime: new Date(block.startDateTime).getTime(),
          block,
        })),
      ].sort((left, right) => left.sortTime - right.sortTime),
    [visibleAppointments, visibleBlocks]
  );
  const visibleSummary = useMemo(
    () => getVisibleAgendaSummary(visibleAppointments),
    [visibleAppointments]
  );
  const selectedBarberId = draftFilters.barberId || appliedFilters.barberId || "";

  useEffect(() => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }, [initialFilters]);

  function updateDraftFilter(key: keyof AdminAgendaFilters, value: string) {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = normalizeAgendaDateFilters(draftFilters);

    setDraftFilters(nextFilters);
    startFilterTransition(() => {
      router.push(buildAgendaUrl(nextFilters), { scroll: false });
    });
  }

  function clearFilters() {
    const today = getCurrentScheduleDateValue();
    setDraftFilters({ dateFrom: today, dateTo: today, barberId: "" });
    startFilterTransition(() => {
      router.push("/admin/agenda", { scroll: false });
    });
  }

  function applyBarberFilter(barberId: string) {
    const nextFilters = normalizeAgendaDateFilters({
      ...draftFilters,
      barberId,
    });

    setDraftFilters(nextFilters);
    startFilterTransition(() => {
      router.push(buildAgendaUrl(nextFilters), { scroll: false });
    });
  }

  return (
    <DashboardShell size="wide" className="max-w-full space-y-5 overflow-x-hidden">
      <section className="dashboard-panel relative z-20 max-w-full p-3 sm:p-6">
        <div className="mb-5">
          <BackLink href="/admin" area="Admin" />
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              Painel admin
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Agenda geral
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Controle todos os horários da barbearia com filtros rápidos,
              status visível e leitura confortável no celular.
            </p>
          </div>
        </div>
        <div className="mt-5 min-w-0 border-t border-white/10 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Agendamentos
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Horários encontrados
            </h2>
          </div>
          <p className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-semibold text-zinc-300">
            {visibleTimelineItems.length} registro(s)
          </p>
        </div>

        <div className="mt-3 border-t border-white/10 pt-3">
          {isTruncated ? (
            <div className="mb-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Mostrando os primeiros {limit} registros para manter a agenda rapida.
              Refine os filtros ou exporte o CSV para consultar o periodo completo.
            </div>
          ) : null}

          <form
            onSubmit={applyFilters}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
                  Filtro por data
                </p>

                <div className="mt-3">
                  <div className="grid gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center">
                    <span className="compact-filter-label">Data</span>
                    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                      <input
                        type="date"
                        value={draftFilters.dateFrom}
                        max={draftFilters.dateTo || undefined}
                        onChange={(event) =>
                          updateDraftFilter("dateFrom", event.target.value)
                        }
                        className="compact-filter-control min-w-0"
                      />
                      <span className="text-[11px] font-semibold text-zinc-500">
                        até
                      </span>
                      <input
                        type="date"
                        value={draftFilters.dateTo}
                        min={draftFilters.dateFrom || undefined}
                        onChange={(event) =>
                          updateDraftFilter("dateTo", event.target.value)
                        }
                        className="compact-filter-control min-w-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:shrink-0 lg:mt-0">
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={isFilterPending}
                  className="min-h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
                >
                  Limpar
                </button>
                <button
                  type="submit"
                  disabled={isFilterPending}
                  className="min-h-10 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {isFilterPending ? "Aplicando..." : "Aplicar"}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
                Barbeiros
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Toque na foto para ver somente a agenda do profissional.
              </p>
            </div>
            {draftFilters.barberId ? (
              <button
                type="button"
                onClick={() => applyBarberFilter("")}
                disabled={isFilterPending}
                className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
              >
                Todos
              </button>
            ) : null}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <BarberFilterButton
              active={!draftFilters.barberId}
              label="Todos"
              image={null}
              icon={<UsersRound />}
              onClick={() => applyBarberFilter("")}
              disabled={isFilterPending}
            />
            {barbers.map((barber) => (
              <BarberFilterButton
                key={barber.id}
                active={draftFilters.barberId === barber.id}
                label={barber.name || barber.email || "Barbeiro"}
                image={barber.image}
                onClick={() => applyBarberFilter(barber.id)}
                disabled={isFilterPending}
              />
            ))}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            <AdminWalkInAppointmentButton
              barbers={barbers}
              services={services}
              extras={extras}
              selectedBarberId={selectedBarberId}
              selectedDate={draftFilters.dateFrom || appliedFilters.dateFrom}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          <AgendaMetric
            icon={<ClipboardList />}
            label="Total"
            value={visibleSummary.total}
            helper="resultado visível"
          />
          <AgendaMetric
            icon={<Clock3 />}
            label="Agendados"
            value={visibleSummary.scheduled}
            helper="horários na agenda"
            tone="info"
          />
          <AgendaMetric
            icon={<CheckCircle2 />}
            label="Concluídos"
            value={visibleSummary.completed}
            helper="atendimentos finalizados"
            tone="success"
          />
          <AgendaMetric
            icon={<XCircle />}
            label="Cancelados"
            value={visibleSummary.cancelled}
            helper="cancelados ou falta"
            tone="danger"
          />
        </div>

        {visibleTimelineItems.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title={
                appliedFilters.q
                  ? "Nenhum resultado para a busca"
                  : "Nenhum agendamento encontrado"
              }
              description={
                appliedFilters.q
                  ? "Confira o ID, nome do cliente ou data digitada."
                  : "Ajuste os filtros para encontrar outros horários."
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-5 grid min-w-0 max-w-full gap-3 overflow-hidden md:hidden">
              {visibleTimelineItems.map((item) =>
                item.type === "block" ? (
                  <AgendaBlockMobileCard key={item.id} block={item.block} />
                ) : (
                  <AppointmentMobileCard
                    key={item.id}
                    appointment={item.appointment}
                    barbers={barbers}
                    services={services}
                    extras={extras}
                  />
                )
              )}
            </div>

            <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-white/10 bg-black/20 md:block">
              <table className="table-premium min-w-[1200px]">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Data</th>
                    <th>Hora</th>
                    <th>Barbeiro</th>
                    <th>Cliente</th>
                    <th>Serviço</th>
                    <th>Extras</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Observações</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTimelineItems.map((item) => {
                    if (item.type === "block") {
                      return <AgendaBlockTableRow key={item.id} block={item.block} />;
                    }

                    const appointment = item.appointment;
                    const date = new Date(appointment.date);

                    return (
                      <tr key={appointment.id}>
                        <td className="font-semibold text-[var(--brand-strong)]">
                          {formatAppointmentPublicId(appointment.publicId)}
                        </td>
                        <td>{formatScheduleDate(date)}</td>
                        <td>{formatScheduleTime(date)}</td>
                        <td>{appointment.barber.name}</td>
                        <td>{appointment.customer.name}</td>
                        <td>{getAppointmentDisplayName(appointment.services)}</td>
                        <td className="text-zinc-300">
                          {getAppointmentItemsLabel(appointment.items)}
                        </td>
                        <td>
                          {formatCurrency(
                            getAppointmentGrandTotal(
                              appointment.services,
                              appointment.items
                            )
                          )}
                        </td>
                        <td>
                          <StatusBadge
                            variant={appointmentStatusVariant(appointment.status)}
                          >
                            {appointmentStatusLabel(appointment.status)}
                          </StatusBadge>
                          {normalizeAppointmentStatus(appointment.status) ===
                          "COMPLETED" ? (
                            <p className="mt-1 text-[11px] font-bold text-emerald-200">
                              {paymentMethodLabel(appointment.paymentMethod)}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-xs truncate text-zinc-400">
                          {appointment.notes || "-"}
                        </td>
                        <td>
                          <AdminAppointmentActions
                            appointment={appointment}
                            barbers={barbers}
                            services={services}
                            extras={extras}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        </div>
      </section>
    </DashboardShell>
  );
}

function buildAgendaUrl(filters: AdminAgendaFilters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString()
    ? `/admin/agenda?${params.toString()}`
    : "/admin/agenda";
}

function normalizeAgendaDateFilters(filters: AdminAgendaFilters) {
  const dateFrom = filters.dateFrom.trim();
  const dateTo = filters.dateTo.trim();
  const barberId = filters.barberId?.trim() || "";

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return {
      ...filters,
      dateFrom: dateTo,
      dateTo: dateFrom,
      barberId,
    };
  }

  return {
    ...filters,
    dateFrom,
    dateTo,
    barberId,
  };
}

function matchesAgendaFilters(
  appointment: AdminAgendaAppointment,
  filters: AdminAgendaFilters
) {
  const dateValue = getScheduleDateValue(new Date(appointment.date));

  if (filters.dateFrom && dateValue < filters.dateFrom) {
    return false;
  }

  if (filters.dateTo && dateValue > filters.dateTo) {
    return false;
  }

  if (filters.barberId && appointment.barber.id !== filters.barberId) {
    return false;
  }

  return true;
}

function matchesAgendaBlockFilters(
  block: AdminAgendaBlock,
  filters: AdminAgendaFilters
) {
  if (!filters.barberId) {
    return false;
  }

  if (filters.dateFrom && block.date < filters.dateFrom) {
    return false;
  }

  if (filters.dateTo && block.date > filters.dateTo) {
    return false;
  }

  if (block.barberId !== filters.barberId) {
    return false;
  }

  return true;
}

function BarberFilterButton({
  active,
  label,
  image,
  icon,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  image: string | null;
  icon?: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-[6rem] shrink-0 flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition disabled:opacity-60 ${
        active
          ? "border-[var(--brand)]/60 bg-[var(--brand-muted)] text-white"
          : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-lg font-black text-[var(--brand-strong)]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={label}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : icon ? (
          <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        ) : (
          label.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="line-clamp-2 max-w-24 text-xs font-bold leading-tight">
        {label}
      </span>
    </button>
  );
}

function AgendaMetric({
  icon,
  label,
  value,
  helper,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  helper: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "text-white",
    info: "text-[var(--brand-strong)]",
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
  }[tone];

  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            <span className="h-4 w-4 shrink-0 text-[var(--brand-strong)] [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
            <span className="truncate">{label}</span>
          </div>
          <p className="mt-1 truncate text-xs text-zinc-400">{helper}</p>
        </div>
        <span className={`shrink-0 text-2xl font-black ${toneClass}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function getVisibleAgendaSummary(appointments: AdminAgendaAppointment[]) {
  return appointments.reduce(
    (accumulator, appointment) => {
      const status = normalizeAppointmentStatus(appointment.status);

      accumulator.total += 1;

      if (status === "COMPLETED") {
        accumulator.completed += 1;
      } else if (status === "CANCELLED" || status === "NO_SHOW") {
        accumulator.cancelled += 1;
      } else {
        accumulator.scheduled += 1;
      }

      return accumulator;
    },
    {
      total: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    }
  );
}

function AgendaBlockMobileCard({ block }: { block: AdminAgendaBlock }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [isPending, startTransition] = useTransition();
  const weekDay = getScheduleDayOfWeek(block.date) ?? 0;

  function runAction(
    action: BlockMutationAction,
    formData: FormData,
    onSuccess?: () => void
  ) {
    formData.set("barberId", block.barberId);

    startTransition(async () => {
      const result = await action(formData);
      setFeedback({ message: result.message, tone: result.tone });

      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Excluir este bloqueio da agenda?")) {
      return;
    }

    const formData = new FormData();

    if (block.kind === "recurring") {
      formData.set("recurringBlockId", block.sourceId);
      runAction(deleteAdminAgendaRecurringBlockAction, formData);
      return;
    }

    formData.set("blockId", block.sourceId);
    runAction(deleteAdminAgendaBlockAction, formData);
  }

  return (
    <article className="relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-rose-300/20 bg-rose-500/[0.055] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.14)]">
      <span className="absolute right-3 top-3 rounded-full border border-rose-200/25 bg-rose-400/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-rose-100">
        Bloqueado
      </span>

      <div className="min-w-0 pr-24">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-rose-100/80">
          <CalendarX2 className="h-3 w-3" />
          Pausa
        </p>
        <p className="mt-1 text-2xl font-black leading-none text-white">
          {block.startTime} - {block.endTime}
        </p>
      </div>

      <div className="mt-2 grid gap-1.5 text-sm">
        <p className="font-semibold text-white">Motivo: {block.reason}</p>
        <p className="text-xs leading-5 text-zinc-300">
          Esse horario so aceita encaixes rapidos pelo admin ou barbeiro.
        </p>
      </div>

      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      {isEditing ? (
        <form
          className="mt-3 rounded-2xl border border-rose-200/15 bg-black/20 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            if (block.kind === "recurring") {
              formData.set("recurringBlockId", block.sourceId);
              formData.set("weekDay", String(weekDay));
            } else {
              formData.set("blockId", block.sourceId);
              formData.set(
                "startDateTime",
                `${block.date}T${String(formData.get("startTime") || "")}`
              );
              formData.set(
                "endDateTime",
                `${block.date}T${String(formData.get("endTime") || "")}`
              );
            }

            runAction(
              block.kind === "recurring"
                ? updateAdminAgendaRecurringBlockAction
                : updateAdminAgendaBlockAction,
              formData,
              () => setIsEditing(false)
            );
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-rose-100/70">
                Inicio
              </span>
              <input
                name="startTime"
                type="time"
                defaultValue={block.startTime}
                required
                className="min-h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-rose-200/50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-rose-100/70">
                Fim
              </span>
              <input
                name="endTime"
                type="time"
                defaultValue={block.endTime}
                required
                className="min-h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-rose-200/50"
              />
            </label>
          </div>

          <label className="mt-2 block">
            <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-rose-100/70">
              Motivo
            </span>
            <input
              name="reason"
              defaultValue={block.reason}
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-rose-200/50"
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-bold text-white"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            <PencilLine className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-500/10 text-sm font-bold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      )}
    </article>
  );
}

function AgendaBlockTableRow({ block }: { block: AdminAgendaBlock }) {
  return (
    <tr>
      <td className="font-semibold text-[var(--brand-strong)]">Bloqueio</td>
      <td>{formatScheduleDate(new Date(block.startDateTime))}</td>
      <td>
        {block.startTime} - {block.endTime}
      </td>
      <td>{block.barberName || "Barbeiro"}</td>
      <td className="text-zinc-500">-</td>
      <td>{block.reason}</td>
      <td className="text-zinc-500">-</td>
      <td className="text-zinc-500">-</td>
      <td>
        <span className="inline-flex rounded-full border border-[var(--brand)]/35 bg-[var(--brand)]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--brand-strong)]">
          Bloqueado
        </span>
      </td>
      <td className="max-w-xs text-zinc-400">
        Esse horario so aceita encaixes rapidos pelo admin ou barbeiro.
      </td>
      <td className="text-zinc-500">-</td>
    </tr>
  );
}

function AppointmentMobileCard({
  appointment,
  barbers,
  services,
  extras,
}: {
  appointment: AdminAgendaAppointment;
  barbers: AdminAgendaBarber[];
  services: AdminAgendaService[];
  extras: AdminAgendaExtra[];
}) {
  const date = new Date(appointment.date);
  const total = getAppointmentGrandTotal(appointment.services, appointment.items);
  const extrasLabel = getAppointmentItemsLabel(appointment.items);
  const notes = appointment.notes?.trim();
  const [isExpanded, setIsExpanded] = useState(false);
  const status = normalizeAppointmentStatus(appointment.status);
  const serviceName = getAppointmentDisplayName(appointment.services);

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
      className="relative min-w-0 max-w-full cursor-pointer overflow-hidden rounded-[24px] border border-white/10 bg-black/25 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)] transition hover:border-white/15 hover:bg-white/[0.035]"
    >
      <StatusBadge
        variant={appointmentStatusVariant(appointment.status)}
        className="absolute right-4 top-4 w-fit max-w-[130px] shrink-0 justify-center px-2.5 py-1 text-[10px]"
      >
        {appointmentStatusLabel(appointment.status)}
      </StatusBadge>

      <div className="min-w-0 pr-28">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
          {formatAppointmentPublicId(appointment.publicId)}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
          {formatScheduleDate(date)}
        </p>
        <p className="text-3xl font-black leading-none text-white">
          {formatScheduleTime(date)}
        </p>
        <h3 className="mt-3 min-w-0 truncate text-base font-semibold text-white">
          {appointment.customer.name || "Cliente"}
        </h3>
        <p className="mt-1 min-w-0 truncate text-sm text-zinc-400">{serviceName}</p>
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-3 border-t border-white/10 pt-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
          <UsersRound className="h-3.5 w-3.5 shrink-0 text-[var(--brand-strong)]/80" />
          <span className="shrink-0 font-semibold">Responsavel</span>
          <span className="min-w-0 truncate font-bold text-zinc-300">
            {appointment.barber.name || "Barbeiro"}
          </span>
        </div>
        <span className="shrink-0 text-xs font-black text-zinc-300">{formatCurrency(total)}</span>
      </div>

      {status === "COMPLETED" ? (
        <span className="absolute right-4 top-12 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">
          {paymentMethodLabel(appointment.paymentMethod)}
        </span>
      ) : null}

      {isExpanded ? (
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
      <div className="mt-3 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              Serviço
            </p>
            <p className="mt-0.5 break-words text-sm font-semibold text-white">
              {serviceName}
            </p>
          </div>
        </div>

        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            Extras
          </p>
          <p className="mt-0.5 break-words text-sm text-zinc-300">{extrasLabel}</p>
        </div>

        {notes ? (
          <div className="mt-2 border-t border-white/10 pt-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              Observações
            </p>
            <p className="mt-0.5 break-words text-sm text-zinc-300">{notes}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <AdminAppointmentActions
          appointment={appointment}
          barbers={barbers}
          services={services}
          extras={extras}
        />
      </div>
        </div>
      ) : null}
    </article>
  );
}

export function AdminAppointmentActions({
  appointment,
  barbers,
  services,
  extras,
}: {
  appointment: AdminAgendaAppointment;
  barbers: AdminAgendaBarber[];
  services: AdminAgendaService[];
  extras: AdminAgendaExtra[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPaymentPromptOpen, setIsPaymentPromptOpen] = useState(false);
  const [actionFeedback, setActionFeedback] =
    useState<OperationalFeedbackState>(null);
  const status = normalizeAppointmentStatus(appointment.status);
  const isCompleted = status === "COMPLETED";
  const isFinalStatus = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status);
  const canEdit = true;
  const canChangeStatus = true;
  const actionPending = isPending || isSubmitting;

  function runStatus(
    nextStatus: string,
    paymentMethod?: AppointmentPaymentMethod
  ) {
    if (actionPending) {
      return;
    }

    if (nextStatus === "COMPLETED" && !paymentMethod) {
      setIsPaymentPromptOpen(true);
      return;
    }

    const reason =
      nextStatus === "CANCELLED"
        ? window.prompt("Motivo do cancelamento:")?.trim()
        : "";

    if (nextStatus === "CANCELLED" && !reason) {
      return;
    }

    setIsSubmitting(true);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("appointmentId", appointment.id);
        formData.set("status", nextStatus);

        if (paymentMethod) {
          formData.set("paymentMethod", paymentMethod);
        }

        if (reason) {
          formData.set("cancellationReason", reason);
        }

        const result = await updateAdminAppointmentStatusAction(formData);

        if (result.ok) {
          setActionFeedback(null);
          setIsPaymentPromptOpen(false);
          router.refresh();
        } else {
          setActionFeedback({
            title:
              nextStatus === "COMPLETED"
                ? "Nao foi possivel concluir"
                : "Nao foi possivel atualizar",
            message: result.message,
            tone: "error",
          });
        }
      } catch {
        setActionFeedback({
          title: "Erro ao salvar",
          message:
            "Nao foi possivel atualizar o atendimento agora. Confira sua conexao e tente novamente.",
          tone: "error",
        });
      } finally {
        setIsSubmitting(false);
      }
    });
  }

  return (
    <>
    <div className="grid min-w-[220px] grid-cols-2 gap-2 sm:grid-cols-4">
      {canEdit ? (
        <AdminActionButton
          icon={<PencilLine className="h-4 w-4" />}
          label="Editar"
          tone="neutral"
          type="button"
          disabled={actionPending}
          onClick={() => setIsEditing(true)}
        />
      ) : null}

      {canChangeStatus ? (
        <>
          {isFinalStatus ? (
            <AdminActionButton
              icon={<RotateCcw className="h-4 w-4" />}
              label="Reabrir"
              tone="sky"
              type="button"
              disabled={actionPending}
              onClick={() => runStatus("CONFIRMED")}
            />
          ) : null}
          {!isCompleted ? (
            <AdminActionButton
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Concluir"
              tone="emerald"
              type="button"
              disabled={actionPending}
              onClick={() => runStatus("COMPLETED")}
            />
          ) : null}
          {status !== "NO_SHOW" ? (
            <AdminActionButton
              icon={<UserX className="h-4 w-4" />}
              label="Falta"
              tone="amber"
              type="button"
              disabled={actionPending}
              onClick={() => runStatus("NO_SHOW")}
            />
          ) : null}
          {status !== "CANCELLED" ? (
            <AdminActionButton
              icon={<XCircle className="h-4 w-4" />}
              label="Cancelar"
              tone="rose"
              type="button"
              disabled={actionPending}
              onClick={() => runStatus("CANCELLED")}
            />
          ) : null}
        </>
      ) : (
        <span className="self-center text-xs font-semibold text-zinc-500">
          Atendimento finalizado
        </span>
      )}

      {isEditing ? (
        <AdminAppointmentEditModal
          appointment={appointment}
          barbers={barbers}
          services={services}
          extras={extras}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
      {isPaymentPromptOpen ? (
        <AdminPaymentMethodPrompt
          isPending={actionPending}
          onClose={() => setIsPaymentPromptOpen(false)}
          onSelect={(paymentMethod) => runStatus("COMPLETED", paymentMethod)}
        />
      ) : null}
    </div>
    <OperationalFeedbackDialog
      feedback={actionFeedback}
      onClose={() => setActionFeedback(null)}
    />
    </>
  );
}

function AdminPaymentMethodPrompt({
  isPending,
  onClose,
  onSelect,
}: {
  isPending: boolean;
  onClose: () => void;
  onSelect: (paymentMethod: AppointmentPaymentMethod) => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-4 py-5 backdrop-blur-md"
      onClick={onClose}
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
    >
      <div
        className="relative z-[410] w-full max-w-sm rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,22,32,0.98),rgba(8,12,20,0.98))] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
          Pagamento
        </p>
        <h3 className="mt-2 text-2xl font-black">Como o cliente pagou?</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          A forma escolhida ficara marcada nos cards e no financeiro.
        </p>

        <div className="mt-5 grid gap-2">
          {APPOINTMENT_PAYMENT_METHODS.map((paymentMethod) => (
            <button
              key={paymentMethod}
              type="button"
              disabled={isPending}
              onClick={() => onSelect(paymentMethod)}
              className="min-h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-base font-black text-white transition hover:border-[var(--brand)]/60 hover:bg-[var(--brand-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paymentMethodLabel(paymentMethod)}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={onClose}
          className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
        >
          Voltar
        </button>
      </div>
    </div>,
    document.body
  );
}

function AdminActionButton({
  icon,
  label,
  tone,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  tone: "neutral" | "sky" | "emerald" | "amber" | "rose";
}) {
  const styles = {
    neutral:
      "border-white/10 bg-white/[0.035] text-zinc-100 hover:border-white/20 hover:bg-white/[0.07]",
    sky:
      "border-sky-300/30 bg-sky-400/10 text-sky-100 hover:border-sky-300/50 hover:bg-sky-400/15",
    emerald:
      "border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/50 hover:bg-emerald-400/15",
    amber:
      "border-amber-300/30 bg-amber-400/10 text-amber-100 hover:border-amber-300/50 hover:bg-amber-400/15",
    rose:
      "border-rose-300/30 bg-rose-500/10 text-rose-100 hover:border-rose-300/50 hover:bg-rose-500/15",
  }[tone];

  return (
    <button
      {...props}
      className={`group inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-black transition shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/8 transition group-hover:bg-white/12 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function AdminAppointmentEditModal({
  appointment,
  barbers,
  services,
  extras,
  onClose,
}: {
  appointment: AdminAgendaAppointment;
  barbers: AdminAgendaBarber[];
  services: AdminAgendaService[];
  extras: AdminAgendaExtra[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const [dialogFeedback, setDialogFeedback] =
    useState<OperationalFeedbackState>(null);
  const [selectedBarberId, setSelectedBarberId] = useState(appointment.barber.id);
  const date = new Date(appointment.date);
  const status = normalizeAppointmentStatus(appointment.status);
  const isCompletedEdit = ["COMPLETED", "DONE"].includes(status);
  const selectedServiceIds = new Set(
    appointment.services.map((service) => service.serviceId)
  );
  const selectedExtraIds = new Set(
    appointment.items.map((item) => item.extraProductId)
  );
  const availableServices = services.filter(
    (service) => !service.barberId || service.barberId === selectedBarberId
  );

  useEffect(() => {
    setIsMounted(true);
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  function submitEdit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await editAdminAppointmentAction(formData);

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

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[280] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6"
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
    >
      <form
        action={submitEdit}
        className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,22,32,0.98),rgba(8,12,20,0.98))] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:max-h-[calc(100svh-3rem)]"
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <input type="hidden" name="appointmentId" value={appointment.id} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Admin
            </p>
            <h3 className="mt-2 text-xl font-bold">
              {isCompletedEdit ? "Editar itens concluidos" : "Editar agendamento"}
            </h3>
            {isCompletedEdit ? (
              <p className="mt-1 text-sm text-zinc-400">
                Atendimento finalizado: ajuste somente servicos, extras e observacoes.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200"
          >
            Fechar
          </button>
        </div>

        {isCompletedEdit ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ReadOnlyEditTile label="Barbeiro" value={appointment.barber.name || "Barbeiro"} />
            <ReadOnlyEditTile label="Data" value={formatScheduleDate(date)} />
            <ReadOnlyEditTile label="Hora" value={formatScheduleTime(date)} />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-semibold text-zinc-200">
              Barbeiro
              <select
                name="barberId"
                value={selectedBarberId}
                onChange={(event) => setSelectedBarberId(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-white outline-none"
              >
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name || barber.email || "Barbeiro"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-zinc-200">
              Data
              <input
                type="date"
                name="date"
                defaultValue={getScheduleDateValue(date)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-white outline-none"
              />
            </label>
            <label className="block text-sm font-semibold text-zinc-200">
              Hora
              <input
                type="time"
                name="time"
                defaultValue={formatScheduleTime(date)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-white outline-none"
              />
            </label>
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
            Serviços
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {availableServices.map((service) => (
              <label
                key={service.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={service.id}
                  defaultChecked={selectedServiceIds.has(service.id)}
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
            ))}
          </div>
        </div>

        <details className="group mt-5 rounded-2xl border border-white/10 bg-white/[0.025]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-[var(--brand-strong)]/25 bg-[var(--brand)]/10 px-3 py-2.5 transition hover:border-[var(--brand-strong)]/45 hover:bg-[var(--brand)]/15 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20 text-[var(--brand-strong)]">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-white">
                  Extras
                </span>
                <span className="block text-xs font-semibold normal-case tracking-normal text-zinc-400">
                  Clique para escolher produtos extras
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black text-[var(--brand-strong)]">
                {selectedExtraIds.size}
              </span>
              <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180 group-open:text-white" />
            </span>
          </summary>
          <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2">
            {extras.map((extra) => (
              <label
                key={extra.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="extraProductIds"
                  value={extra.id}
                  defaultChecked={selectedExtraIds.has(extra.id)}
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
            ))}
          </div>
        </details>

        <label className="mt-5 block text-sm font-semibold text-zinc-200">
          Observações
          <textarea
            name="notes"
            rows={3}
            maxLength={400}
            defaultValue={appointment.notes || ""}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-white outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="mt-5 min-h-11 w-full rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>
      <OperationalFeedbackDialog
        feedback={dialogFeedback}
        onClose={() => setDialogFeedback(null)}
      />
    </div>,
    document.body
  );
}

function ReadOnlyEditTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function matchesAgendaSearch(
  appointment: AdminAgendaAppointment,
  rawQuery: string
) {
  const query = normalizeSearchValue(rawQuery);
  const queryDigits = rawQuery.replace(/\D/g, "");
  const date = new Date(appointment.date);
  const formattedPublicId = formatAppointmentPublicId(appointment.publicId);
  const formattedDate = formatScheduleDate(date);
  const dateValue = getScheduleDateValue(date);
  const searchableText = normalizeSearchValue(
    [
      appointment.id,
      appointment.publicId,
      formattedPublicId,
      appointment.customer.name,
      appointment.customer.email,
      formattedDate,
      dateValue,
    ].join(" ")
  );
  const searchableDigits = [
    appointment.id,
    appointment.publicId,
    formattedPublicId,
    formattedDate,
    dateValue,
  ]
    .join(" ")
    .replace(/\D/g, "");

  return (
    searchableText.includes(query) ||
    (queryDigits.length > 0 && searchableDigits.includes(queryDigits))
  );
}

function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
