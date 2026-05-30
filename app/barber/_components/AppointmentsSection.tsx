"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarX2, PencilLine, Save, Trash2, X } from "lucide-react";
import FeedbackMessage from "@/components/FeedbackMessage";
import EmptyState from "@/components/ui/EmptyState";
import { PremiumDatePicker, PremiumSelect } from "@/components/ui/PremiumFilters";
import SectionCard from "@/components/ui/SectionCard";
import {
  getAppointmentDisplayName,
  getAppointmentServiceMetaLine,
} from "@/lib/appointmentServices";
import { toMoneyNumber } from "@/lib/money";
import {
  getCurrentScheduleDate,
  getScheduleDayOfWeek,
} from "@/lib/scheduleTime";
import { buildAppointmentContactWhatsAppUrl } from "@/lib/whatsapp";
import { getManualFitInCustomerDisplay } from "@/lib/manualFitIn";
import type { getBarberAgendaData } from "../data";
import BarberAppointmentActions from "./BarberAppointmentActions";
import BarberAppointmentCard from "./BarberAppointmentCard";
import {
  deleteBarberBlockAction,
  deleteRecurringBarberBlockAction,
  updateBarberBlockAction,
  updateRecurringBarberBlockAction,
} from "../actions";

type BarberAgendaData = Awaited<ReturnType<typeof getBarberAgendaData>>;
type BlockMutationAction = (formData: FormData) => Promise<{
  ok: boolean;
  message: string;
  tone: "success" | "error" | "info";
}>;

type AppointmentsSectionProps = {
  appointments: BarberAgendaData["appointments"];
  blocks: BarberAgendaData["blocks"];
  services: BarberAgendaData["services"];
  extras: BarberAgendaData["extras"];
  filters: BarberAgendaData["filters"];
  barberName: string;
  shopName: string;
};

function getTodayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAgendaDays(selectedDate: string) {
  const days: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  for (let index = 0; index < 12; index += 1) {
    const current = new Date(base);
    current.setDate(base.getDate() + index);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");

    days.push(`${year}-${month}-${day}`);
  }

  if (selectedDate && !days.includes(selectedDate)) {
    return [selectedDate, ...days];
  }

  return days;
}

function formatAgendaDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  return {
    weekday: date.toLocaleDateString("pt-BR", { weekday: "short" }),
    day: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  };
}

export function AppointmentsSection({
  appointments,
  blocks,
  services,
  extras,
  filters,
  barberName,
  shopName,
}: AppointmentsSectionProps) {
  const router = useRouter();
  const pathname = usePathname() || "/barber/agenda";
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [visibleAppointments, setVisibleAppointments] = useState(appointments);
  const [isFilterPending, startFilterTransition] = useTransition();
  const [isBlockPending, startBlockTransition] = useTransition();
  const [pendingBlockKey, setPendingBlockKey] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(filters.status);
  const [selectedDate, setSelectedDate] = useState(filters.date);
  const agendaDays = useMemo(
    () => getAgendaDays(selectedDate || getTodayValue()),
    [selectedDate]
  );
  const filterDefaults = useMemo(
    () => ({
      status: filters.status,
      date: filters.date,
    }),
    [filters.date, filters.status]
  );
  const highlightedAppointmentId = useMemo(() => {
    const openAppointments = visibleAppointments.filter(
      (appointment) =>
        !["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"].includes(
          appointment.status
        )
    );
    const currentDate = getCurrentScheduleDate().getTime();

    return (
      openAppointments.find(
        (appointment) => new Date(appointment.date).getTime() >= currentDate
      )?.id ||
      openAppointments[0]?.id ||
      null
    );
  }, [visibleAppointments]);
  const timelineItems = useMemo(
    () =>
      [
        ...visibleAppointments.map((appointment) => ({
          type: "appointment" as const,
          id: appointment.id,
          sortTime: new Date(appointment.date).getTime(),
          appointment,
        })),
        ...blocks.map((block) => ({
          type: "block" as const,
          id: block.id,
          sortTime: new Date(block.startDateTime).getTime(),
          block,
        })),
      ].sort((left, right) => left.sortTime - right.sortTime),
    [blocks, visibleAppointments]
  );

  useEffect(() => {
    setSelectedStatus(filterDefaults.status);
    setSelectedDate(filterDefaults.date);
  }, [filterDefaults.date, filterDefaults.status]);

  useEffect(() => {
    setVisibleAppointments(appointments);
  }, [appointments]);

  function handleStatusUpdated(appointmentId: string, status: string) {
    const finalStatuses = ["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"];

    setVisibleAppointments((current) => {
      if (selectedStatus === "ACTIVE" && finalStatuses.includes(status)) {
        return current.filter((appointment) => appointment.id !== appointmentId);
      }

      return current.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, status } : appointment
      );
    });
  }

  function runBlockAction(
    key: string,
    action: BlockMutationAction,
    formData: FormData,
    onSuccess?: () => void
  ) {
    setPendingBlockKey(key);

    startBlockTransition(async () => {
      const result = await action(formData);
      setFeedback({ message: result.message, tone: result.tone });

      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }

      setPendingBlockKey(null);
    });
  }

  function applyFilters(nextFilters = {
    status: selectedStatus,
    date: selectedDate,
  }) {
    const params = new URLSearchParams();
    const status = nextFilters.status || "ACTIVE";
    const date = nextFilters.date || getTodayValue();

    if (status && status !== "ACTIVE") {
      params.set("status", status);
    }

    if (date) {
      params.set("view", "day");
      params.set("date", date);
    }

    startFilterTransition(() => {
      router.replace(
        params.toString() ? `${pathname}?${params.toString()}` : pathname,
        { scroll: false }
      );
    });
  }

  return (
    <SectionCard
      title="Agenda"
      description="Seus horários, clientes e próximas ações."
      className="max-w-full rounded-[28px] border-white/10 bg-white/[0.04] backdrop-blur"
      actions={
        <div className="w-full space-y-4">
          <div className="max-w-sm">
            <PremiumDatePicker
              name="date"
              label="Calendário"
              value={selectedDate || getTodayValue()}
              onChange={(value) => {
                const next = {
                  status: selectedStatus,
                  date: value || getTodayValue(),
                };

                setSelectedDate(next.date);
                applyFilters(next);
              }}
            />
          </div>

          <div className="min-w-0">
            <p className="mb-2 block text-sm text-zinc-300">Dias rápidos</p>
            <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
              {agendaDays.map((dayValue) => {
                const isSelected = dayValue === (selectedDate || getTodayValue());
                const { weekday, day } = formatAgendaDay(dayValue);

                return (
                  <button
                    key={dayValue}
                    type="button"
                    onClick={() => {
                      const next = {
                        status: selectedStatus,
                        date: dayValue,
                      };

                      setSelectedDate(next.date);
                      applyFilters(next);
                    }}
                    className={`min-w-[82px] rounded-2xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-[var(--brand)] bg-[var(--brand-muted)] text-white shadow-[0_18px_36px_rgba(14,165,233,0.18)]"
                        : "border-white/10 bg-black/20 text-white hover:border-white/20"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {weekday}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{day}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-sm">
            <PremiumSelect
              name="status"
              label="Status"
              value={selectedStatus}
              options={[
                { value: "ACTIVE", label: "Fluxo do dia" },
                { value: "ALL", label: "Histórico completo" },
                { value: "CONFIRMED", label: "Agendado" },
                { value: "COMPLETED", label: "Concluído" },
                { value: "CANCELLED", label: "Cancelado" },
                { value: "NO_SHOW", label: "Não compareceu" },
              ]}
              onChange={(value) => {
                const next = {
                  status: value,
                  date: selectedDate,
                };

                setSelectedStatus(next.status);
                applyFilters(next);
              }}
            />
          </div>

          {isFilterPending ? (
            <p className="text-xs text-zinc-500">
              Atualizando agenda...
            </p>
          ) : null}
        </div>
      }
    >
      <div className="mt-6 space-y-3">
        <FeedbackMessage message={feedback.message} tone={feedback.tone} />
      </div>

      <div className="mt-6 space-y-4">
        {timelineItems.length === 0 ? (
          <EmptyState
            title="Nenhum agendamento encontrado"
            description="Ajuste os filtros acima para ver outros horários ou volte mais tarde."
          />
        ) : (
          timelineItems.map((item) => {
            if (item.type === "block") {
              return (
                <BarberAgendaBlockCard
                  key={item.id}
                  block={item.block}
                  isPending={isBlockPending}
                  pendingKey={pendingBlockKey}
                  onRunAction={runBlockAction}
                />
              );
            }

            const appointment = item.appointment;
            const serviceName = getAppointmentDisplayName(appointment.services);
            const serviceMeta = getAppointmentServiceMetaLine(appointment.services);
            const appointmentCustomer = appointment.isManualFitIn
              ? getManualFitInCustomerDisplay({
                  notes: appointment.notes,
                  fallbackCustomer: appointment.customer,
                })
              : {
                  name: appointment.customer.name || "Cliente",
                  phone: appointment.customer.phone || null,
                  email: appointment.customer.email || null,
                };
            const cardAppointment = {
              id: appointment.id,
              publicId: appointment.publicId,
              date: appointment.date,
              status: appointment.status,
              paymentMethod: appointment.paymentMethod,
              isManualFitIn: appointment.isManualFitIn,
              notes: appointment.notes,
              customer: {
                id: appointment.customer.id,
                name: appointmentCustomer.name,
                phone: appointmentCustomer.phone || null,
                email: appointmentCustomer.email || null,
              },
              serviceName,
              serviceMeta,
              items: appointment.items.map((item) => ({
                id: item.id,
                extraProductId: item.extraProductId,
                productNameSnapshot: item.productNameSnapshot,
                quantity: item.quantity,
                isDelivered: item.isDelivered,
                deliveredAt: item.deliveredAt,
              })),
              services: appointment.services.map((service) => ({
                serviceId: service.serviceId,
                nameSnapshot: service.nameSnapshot,
                priceSnapshot: toMoneyNumber(service.priceSnapshot),
                durationSnapshot: service.durationSnapshot,
                orderIndex: service.orderIndex,
              })),
            };
            const contactHref = buildAppointmentContactWhatsAppUrl({
              customerName: cardAppointment.customer.name,
              barberName,
              shopName,
              serviceName,
              appointmentDate: appointment.date,
              customerPhone: cardAppointment.customer.phone,
            });

            return (
              <BarberAppointmentCard
                key={appointment.id}
                appointment={cardAppointment}
                highlighted={appointment.id === highlightedAppointmentId}
                contactHref={contactHref}
                actions={(review) => (
                  <BarberAppointmentActions
                    appointmentId={appointment.id}
                    status={appointment.status}
                    onFeedback={setFeedback}
                    onStatusUpdated={handleStatusUpdated}
                    hasPickupItems={review.hasPickupItems}
                    allPickupItemsReviewed={review.allPickupItemsReviewed}
                    itemDeliveryDecisions={review.itemDeliveryDecisions}
                    services={services}
                    extras={extras}
                    currentServiceIds={cardAppointment.services.map(
                      (service) => service.serviceId
                    )}
                    currentExtraProductIds={cardAppointment.items.map(
                      (item) => item.extraProductId
                    )}
                    notes={cardAppointment.notes}
                  />
                )}
              />
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

function BarberAgendaBlockCard({
  block,
  isPending,
  pendingKey,
  onRunAction,
}: {
  block: BarberAgendaData["blocks"][number];
  isPending: boolean;
  pendingKey: string | null;
  onRunAction: (
    key: string,
    action: BlockMutationAction,
    formData: FormData,
    onSuccess?: () => void
  ) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const actionKey = `${block.kind}-${block.sourceId}`;
  const isThisPending = isPending && pendingKey === actionKey;
  const weekDay = getScheduleDayOfWeek(block.date) ?? 0;

  function buildDeleteFormData() {
    const formData = new FormData();

    if (block.kind === "recurring") {
      formData.set("recurringBlockId", block.sourceId);
    } else {
      formData.set("blockId", block.sourceId);
    }

    return formData;
  }

  function handleDelete() {
    if (!window.confirm("Excluir este bloqueio da agenda?")) {
      return;
    }

    onRunAction(
      actionKey,
      block.kind === "recurring"
        ? deleteRecurringBarberBlockAction
        : deleteBarberBlockAction,
      buildDeleteFormData()
    );
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-rose-300/20 bg-rose-500/[0.055] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.14)]">
      <div className="absolute right-3 top-3 rounded-full border border-rose-200/25 bg-rose-400/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-rose-100">
        Bloqueado
      </div>

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

            onRunAction(
              actionKey,
              block.kind === "recurring"
                ? updateRecurringBarberBlockAction
                : updateBarberBlockAction,
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
              disabled={isThisPending}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isThisPending ? "Salvando..." : "Salvar"}
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
            disabled={isThisPending}
            onClick={handleDelete}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-500/10 text-sm font-bold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {isThisPending ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      )}
    </article>
  );
}
