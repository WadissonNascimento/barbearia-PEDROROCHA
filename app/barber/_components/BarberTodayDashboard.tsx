"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CalendarRange,
  CalendarX2,
  Clock3,
  Crown,
  DollarSign,
  MailOpen,
  PiggyBank,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { markBarberNotificationReadAction } from "@/app/barber/notificationActions";
import FeedbackMessage from "@/components/FeedbackMessage";
import { getCurrentScheduleDate } from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";
import { buildAppointmentContactWhatsAppUrl } from "@/lib/whatsapp";
import type { getBarberTodayDashboardData } from "../data";
import BarberAppointmentActions from "./BarberAppointmentActions";
import BarberAppointmentCard from "./BarberAppointmentCard";
import WalkInAppointmentCard from "./WalkInAppointmentCard";

type BarberTodayDashboardData = Awaited<ReturnType<typeof getBarberTodayDashboardData>>;
type AppNotificationItem = BarberTodayDashboardData["appNotifications"][number];

function formatTodayLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function BarberTodayDashboard({
  barberName,
  shopName,
  summary,
  walkInServices,
  walkInExtras,
  clients,
  appNotifications,
}: {
  barberName: string;
  shopName: string;
  summary: BarberTodayDashboardData["summary"];
  walkInServices: BarberTodayDashboardData["walkInServices"];
  walkInExtras: BarberTodayDashboardData["walkInExtras"];
  clients: BarberTodayDashboardData["clients"];
  appNotifications: BarberTodayDashboardData["appNotifications"];
}) {
  const [appointments, setAppointments] = useState(summary.todayAppointments);
  const [localNotifications, setLocalNotifications] =
    useState<AppNotificationItem[]>(appNotifications);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(
    null
  );
  const [, startNotificationTransition] = useTransition();
  const searchParams = useSearchParams();
  const didOpenNotificationsFromQuery = useRef(false);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });

  useEffect(() => {
    setAppointments(summary.todayAppointments);
  }, [summary.todayAppointments]);

  useEffect(() => {
    setLocalNotifications(appNotifications);
  }, [appNotifications]);

  useEffect(() => {
    if (
      searchParams.get("notifications") === "1" &&
      !didOpenNotificationsFromQuery.current
    ) {
      didOpenNotificationsFromQuery.current = true;
      setIsNotificationsOpen(true);
    }

    if (searchParams.get("notifications") !== "1") {
      didOpenNotificationsFromQuery.current = false;
    }
  }, [searchParams]);

  const visibleAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          !["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"].includes(
            appointment.status
          )
      ),
    [appointments]
  );
  const nextAppointment =
    visibleAppointments.find(
      (appointment) =>
        new Date(appointment.date).getTime() >= getCurrentScheduleDate().getTime()
    ) || visibleAppointments[0] || null;
  const agendaPreviewItems = useMemo(
    () =>
      [
        ...visibleAppointments.map((appointment) => ({
          id: appointment.id,
          type: "appointment" as const,
          sortTime: new Date(appointment.date).getTime(),
          appointment,
        })),
        ...summary.todayBlocks.map((block) => ({
          id: block.id,
          type: "block" as const,
          sortTime: new Date(block.startDateTime).getTime(),
          block,
        })),
      ]
        .sort((left, right) => left.sortTime - right.sortTime)
        .slice(0, 3),
    [summary.todayBlocks, visibleAppointments]
  );
  const notificationItems = useMemo(
    () =>
      localNotifications.map((notification) => {
        const createdAt = new Date(notification.createdAt);

        return {
          id: notification.id,
          eyebrow: notification.eyebrow || "Notificacao",
          title: notification.title,
          preview: notification.body,
          body: notification.body,
          type: notification.type,
          actionUrl: notification.actionUrl,
          metadata: notification.metadata,
          createdAt: createdAt.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
          isNew: !notification.readAt,
        };
      }),
    [localNotifications]
  );
  const selectedNotification =
    notificationItems.find((item) => item.id === selectedNotificationId) || null;

  function handleStatusUpdated(appointmentId: string, status: string) {
    const finalStatuses = ["CANCELLED", "COMPLETED", "DONE", "NO_SHOW"];

    setAppointments((current) => {
      if (finalStatuses.includes(status)) {
        return current.filter((item) => item.id !== appointmentId);
      }

      return current.map((item) =>
        item.id === appointmentId ? { ...item, status } : item
      );
    });

  }

  function handleSelectNotification(notificationId: string) {
    setSelectedNotificationId(notificationId);
    setIsNotificationsOpen(false);
    setLocalNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: notification.readAt || new Date() }
          : notification
      )
    );
    startNotificationTransition(() => {
      void markBarberNotificationReadAction(notificationId);
    });
  }

  return (
    <section className="max-w-full space-y-5 overflow-hidden">
      <div className="max-w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]">
                Hoje
              </p>
              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {barberName.split(" ")[0]}, sua agenda
              </h1>
              <p className="mt-2 text-sm capitalize text-zinc-400">
                {formatTodayLabel()}
              </p>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="Notificacoes"
                aria-expanded={isNotificationsOpen}
                onClick={() => setIsNotificationsOpen((current) => !current)}
                className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/20 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[var(--brand-strong)]/40 hover:bg-[var(--brand)]/10 hover:text-white"
              >
                <Bell className="h-6 w-6" />
              </button>

            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <QuickLink href="/barber/agenda" icon={<CalendarRange />}>
            Agenda
          </QuickLink>
          <QuickLink href="/barber/disponibilidade" icon={<Clock3 />}>
            Disponibilidade
          </QuickLink>
          <QuickLink href="/barber/clientes" icon={<Users />}>
            Clientes
          </QuickLink>
          <QuickLink href="/barber/caixinhas" icon={<PiggyBank />}>
            Anotar caixinha
          </QuickLink>
          <WalkInAppointmentCard
            services={walkInServices}
            extras={walkInExtras}
            clients={clients}
          />
          <QuickLink href="/barber/financeiro" icon={<DollarSign />}>
            Meu financeiro
          </QuickLink>
          <QuickLink
            href="/barber/perfil"
            icon={<Settings />}
            className="col-span-2"
          >
            Configurar perfil
          </QuickLink>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={<CalendarRange />}
            label="Atendimentos"
            value={`${appointments.length}`}
            helper={`${summary.completedToday} concluídos`}
          />
          <MetricCard
            icon={<UserRound />}
            label="Clientes"
            value={`${summary.clientsToday}`}
            helper="passam hoje"
          />
          <MetricCard
            icon={<DollarSign />}
            label="Seu repasse"
            value={formatCurrency(summary.barberPayoutToday)}
            helper="concluído hoje"
          />
        </div>
      </div>

      <FeedbackMessage message={feedback.message} tone={feedback.tone} />

      <div className="min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-white">Agenda do dia</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Horário, cliente e próxima ação.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {agendaPreviewItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-zinc-400">
                Nenhum próximo horário para hoje.
              </div>
            ) : (
              agendaPreviewItems.map((item) => {
                if (item.type === "block") {
                  return <TodayAgendaBlockCard key={item.id} block={item.block} />;
                }

                const appointment = item.appointment;
                const contactHref = buildAppointmentContactWhatsAppUrl({
                  customerName: appointment.customer.name,
                  barberName,
                  shopName,
                  serviceName: appointment.serviceName,
                  appointmentDate: appointment.date,
                  customerPhone: appointment.customer.phone,
                });

                return (
                  <BarberAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    highlighted={appointment.id === nextAppointment?.id}
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
                        services={walkInServices}
                        extras={walkInExtras}
                        currentServiceIds={(appointment.services || []).map(
                          (service) => service.serviceId
                        )}
                        currentExtraProductIds={appointment.items.map(
                          (item) => item.extraProductId || ""
                        ).filter(Boolean)}
                        notes={appointment.notes}
                      />
                    )}
                  />
                );
              })
            )}
          </div>

        <Link
          href="/barber/agenda"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)]"
        >
          Ver agenda completa
        </Link>
      </div>

      {selectedNotification ? (
        <NotificationDetailDialog
          notification={selectedNotification}
          onBack={() => {
            setSelectedNotificationId(null);
            setIsNotificationsOpen(true);
          }}
          onClose={() => setSelectedNotificationId(null)}
        />
      ) : null}
      {isNotificationsOpen ? (
        <NotificationsDialog
          notifications={notificationItems}
          onClose={() => setIsNotificationsOpen(false)}
          onSelect={(notificationId) => {
            handleSelectNotification(notificationId);
          }}
        />
      ) : null}
    </section>
  );
}

function TodayAgendaBlockCard({
  block,
}: {
  block: BarberTodayDashboardData["summary"]["todayBlocks"][number];
}) {
  return (
    <div className="rounded-2xl border border-red-300/20 bg-red-500/[0.06] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-200/80">
            <CalendarX2 className="h-3.5 w-3.5" />
            Bloqueado
          </p>
          <p className="mt-2 text-2xl font-black leading-none">
            {block.startTime} - {block.endTime}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-red-200/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100">
          Pausa
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p className="font-semibold text-white">Motivo: {block.reason}</p>
        <p className="leading-relaxed text-zinc-300">
          Esse horario so aceita encaixes rapidos pelo admin ou barbeiro.
        </p>
      </div>
    </div>
  );
}

function NotificationsDialog({
  notifications,
  onClose,
  onSelect,
}: {
  notifications: Array<{
    id: string;
    eyebrow: string;
    title: string;
    preview: string;
    isNew: boolean;
  }>;
  onClose: () => void;
  onSelect: (notificationId: string) => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="max-h-[calc(100svh-32px)] w-full max-w-lg touch-auto overflow-hidden overscroll-contain rounded-[30px] border border-white/10 bg-[#050b16] text-white shadow-[0_24px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              Notificacoes
            </p>
            <h2 className="mt-2 text-2xl font-bold">Central do barbeiro</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Toque em uma notificacao para ver os detalhes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar notificacoes"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[min(34rem,calc(100svh-12rem))] space-y-3 overflow-y-auto p-4">
          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-400">
              Nenhuma notificacao para agora.
            </div>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`group w-full rounded-[22px] border p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[var(--brand)]/45 ${
                  item.isNew
                    ? "border-white/10 bg-[#0b1220] hover:bg-[#0e1a2d]"
                    : "border-white/[0.06] bg-black/25 opacity-70 hover:bg-[#07101d] hover:opacity-90"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${
                      item.isNew
                        ? "border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]"
                        : "border-white/10 bg-white/[0.03] text-zinc-500"
                    }`}
                  >
                    <MailOpen className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
                        {item.eyebrow}
                      </span>
                      {item.isNew ? (
                        <span className="shrink-0 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-bold text-white">
                          Novo
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`mt-1 block truncate text-base font-bold ${
                        item.isNew ? "text-white" : "text-zinc-300"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="mt-1 block truncate text-sm text-zinc-500">
                      {item.preview}
                    </span>
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function NotificationDetailDialog({
  notification,
  onBack,
  onClose,
}: {
  notification: {
    title: string;
    eyebrow: string;
    body: string;
    type: string;
    createdAt: string;
    actionUrl: string | null;
    metadata: unknown;
  };
  onBack: () => void;
  onClose: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const appointmentCards = getNotificationAppointmentCards(notification.metadata);
  const singleNotificationCard = getSingleNotificationCard(
    notification.type,
    notification.metadata,
    notification.createdAt
  );
  const metadataRows = getNotificationMetadataRows(notification.metadata);

  useEffect(() => {
    setIsMounted(true);
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="flex max-h-[calc(100svh-32px)] w-full max-w-md touch-auto flex-col overflow-hidden overscroll-contain rounded-[28px] border border-white/10 bg-[#050b16] text-white shadow-[0_24px_90px_rgba(0,0,0,0.65)]">
        <div className="shrink-0 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--brand-strong)]">
                {notification.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-tight">
                {notification.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {notification.body}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar notificacao"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {appointmentCards.length > 0 ? (
            <div className="space-y-3">
              {appointmentCards.map((appointment) => (
                <NotificationAppointmentCard
                  key={appointment.id || appointment.appointmentCode}
                  appointment={appointment}
                />
              ))}
            </div>
          ) : singleNotificationCard ? (
            <SingleNotificationCard card={singleNotificationCard} />
          ) : (
            <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm">
              <NotificationDetailRow label="Recebida" value={notification.createdAt} />
              {metadataRows.map((row) => (
                <NotificationDetailRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid shrink-0 gap-2 border-t border-white/10 bg-[#050b16] p-5 pt-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onBack}
            className="min-h-12 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.04]"
          >
            Voltar
          </button>
          {notification.actionUrl ? (
            <Link
              href={notification.actionUrl}
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Abrir
            </Link>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Entendi
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function getNotificationStatusLabel(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "CONFIRMED") return "Agendado";
  if (normalized === "PENDING") return "Pendente";
  if (normalized === "COMPLETED" || normalized === "DONE") return "Concluido";
  if (normalized === "CANCELLED") return "Cancelado";
  if (normalized === "NO_SHOW") return "Faltou";

  return status;
}

type NotificationAppointmentCardData = {
  id: string;
  appointmentCode: string;
  customerName: string;
  phone: string | null;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  reason?: string | null;
  previousDateTime?: string | null;
  nextDateTime?: string | null;
  receivedAt?: string | null;
};

type SingleNotificationCardData =
  | (NotificationAppointmentCardData & { kind: "appointment" })
  | (NotificationAppointmentCardData & {
      kind: "review";
      rating: number;
      reviewComment?: string | null;
    });

function NotificationAppointmentCard({
  appointment,
}: {
  appointment: NotificationAppointmentCardData;
}) {
  const hasScheduleChange =
    appointment.previousDateTime || appointment.nextDateTime;
  const statusLabel = getNotificationStatusLabel(appointment.status);
  const displayTime =
    appointment.time ||
    extractTimeFromDateTime(appointment.nextDateTime) ||
    (hasScheduleChange ? "Reagendado" : "Horario");
  const displayDate =
    appointment.date || extractDateFromDateTime(appointment.nextDateTime);
  const metaParts = [appointment.phone].filter(Boolean);

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border ${getNotificationStatusBorder(
        appointment.status
      )} bg-black/25 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)]`}
    >
      <span
        className={`absolute right-4 top-4 w-fit max-w-[130px] shrink-0 rounded-full border px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-[0.14em] ${getNotificationStatusClass(
          appointment.status
        )}`}
      >
        {statusLabel}
      </span>

      <div className="min-w-0 pr-28">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            {appointment.appointmentCode}
          </p>
          {displayDate ? (
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
              {displayDate}
            </p>
          ) : null}
          <p className="truncate text-2xl font-bold text-white">{displayTime}</p>
          <p className="mt-2 truncate text-base font-semibold text-white">
            {appointment.customerName}
          </p>
          <p className="mt-1 truncate text-sm text-zinc-400">
            {appointment.serviceName}
          </p>
          {metaParts.length > 0 ? (
            <p className="mt-1 truncate text-xs text-zinc-500">
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {hasScheduleChange ? (
        <div className="mt-3 grid gap-2 text-sm">
          {appointment.previousDateTime ? (
            <CompactInfo label="Horario antigo" value={appointment.previousDateTime} />
          ) : null}
          {appointment.nextDateTime ? (
            <CompactInfo
              label="Novo horario"
              value={appointment.nextDateTime}
              tone="brand"
            />
          ) : null}
        </div>
      ) : null}

      {appointment.reason ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            Motivo do cancelamento
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-zinc-100">
            {appointment.reason}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SingleNotificationCard({ card }: { card: SingleNotificationCardData }) {
  if (card.kind === "review") {
    return (
      <div className="space-y-3 rounded-[22px] border border-white/10 bg-[#0b1220] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
              {card.appointmentCode}
            </p>
            <p className="mt-1 truncate text-base font-bold text-white">
              {card.customerName}
            </p>
            <p className="mt-1 truncate text-sm text-zinc-400">
              {card.serviceName}
            </p>
          </div>
          <CrownRating rating={card.rating} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {card.receivedAt ? (
            <CompactInfo label="Recebida" value={card.receivedAt} />
          ) : null}
          <CompactInfo label="Data" value={card.date || "Nao informado"} />
          <CompactInfo label="Horario" value={card.time || "Nao informado"} />
          <CompactInfo label="Telefone" value={card.phone || "Nao informado"} />
          <CompactInfo label="Coroas" value={`${card.rating}`} />
        </div>

        {card.reviewComment ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Comentario
            </p>
            <p className="mt-1 font-bold text-white">{card.reviewComment}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return <NotificationAppointmentCard appointment={card} />;
}

function CrownRating({ rating }: { rating: number }) {
  const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand)]/30 bg-[var(--brand-muted)] px-2.5 py-1 text-[var(--brand-strong)]">
      {Array.from({ length: normalizedRating || 1 }).map((_, index) => (
        <Crown
          key={index}
          className="h-3.5 w-3.5 fill-[var(--brand-strong)]/35"
          strokeWidth={2.2}
        />
      ))}
      <span className="pl-1 text-[10px] font-black text-white">
        {normalizedRating}
      </span>
    </div>
  );
}

function CompactInfo({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand";
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border px-3 py-2 ${
        tone === "brand"
          ? "border-[var(--brand)]/30 bg-[var(--brand-muted)]"
          : "border-white/10 bg-black/20"
      }`}
    >
      <p
        className={`truncate text-[10px] font-black uppercase tracking-[0.18em] ${
          tone === "brand" ? "text-[var(--brand-strong)]" : "text-zinc-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}

function extractTimeFromDateTime(value?: string | null) {
  if (!value) return "";

  return value.match(/\b\d{2}:\d{2}\b/)?.[0] || "";
}

function extractDateFromDateTime(value?: string | null) {
  if (!value) return "";

  return value.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] || "";
}

function getSingleNotificationCard(
  type: string,
  metadata: unknown,
  receivedAt?: string
): SingleNotificationCardData | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const appointmentCode = asString(record.appointmentCode);
  const customerName = asString(record.customerName);
  const serviceName = asString(record.serviceName);

  if (!appointmentCode && !customerName && !serviceName) {
    return null;
  }

  const baseCard: NotificationAppointmentCardData = {
    id: appointmentCode || type,
    appointmentCode: appointmentCode || "Atendimento",
    customerName: customerName || "Cliente",
    phone: asString(record.phone) || null,
    serviceName: serviceName || "Servico agendado",
    date: asString(record.date),
    time: asString(record.time),
    status: getStatusFromNotificationType(type),
    reason: asString(record.reason) || null,
    previousDateTime: asString(record.previousDateTime) || null,
    nextDateTime: asString(record.nextDateTime) || null,
    receivedAt: receivedAt || null,
  };

  if (type === "barber.new_review" || record.rating) {
    return {
      ...baseCard,
      kind: "review",
      rating: Number(record.rating || 0),
      reviewComment: asString(record.reviewComment) || null,
    };
  }

  return {
    ...baseCard,
    kind: "appointment",
  };
}

function getStatusFromNotificationType(type: string) {
  if (type.includes("cancelled") || type.includes("cancelamento")) {
    return "CANCELLED";
  }

  if (type.includes("no_show")) {
    return "NO_SHOW";
  }

  if (type.includes("completed") || type.includes("conclusao")) {
    return "COMPLETED";
  }

  return "CONFIRMED";
}

function getNotificationStatusClass(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "CANCELLED") {
    return "border-red-300/35 bg-red-500/10 text-red-100";
  }

  if (normalized === "NO_SHOW") {
    return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  }

  if (normalized === "COMPLETED" || normalized === "DONE") {
    return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
  }

  return "border-[var(--brand)]/35 bg-[var(--brand-muted)] text-[var(--brand-strong)]";
}

function getNotificationStatusBorder(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "CANCELLED") {
    return "border-red-300/15";
  }

  if (normalized === "NO_SHOW") {
    return "border-amber-300/15";
  }

  if (normalized === "COMPLETED" || normalized === "DONE") {
    return "border-emerald-300/15";
  }

  return "border-white/10";
}

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function getNotificationAppointmentCards(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const appointments = (metadata as Record<string, unknown>).appointments;

  if (!Array.isArray(appointments)) {
    return [];
  }

  return appointments
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;

      return {
        id: String(record.id || record.appointmentCode || ""),
        appointmentCode: String(record.appointmentCode || "Atendimento"),
        customerName: String(record.customerName || "Cliente"),
        phone: record.phone ? String(record.phone) : null,
        serviceName: String(record.serviceName || "Servico agendado"),
        date: String(record.date || ""),
        time: String(record.time || ""),
        status: String(record.status || "Aberto"),
        reason: record.reason ? String(record.reason) : null,
        previousDateTime: record.previousDateTime
          ? String(record.previousDateTime)
          : null,
        nextDateTime: record.nextDateTime ? String(record.nextDateTime) : null,
      };
    })
    .filter(
      (item): item is {
        id: string;
        appointmentCode: string;
        customerName: string;
        phone: string | null;
        serviceName: string;
        date: string;
        time: string;
        status: string;
        reason: string | null;
        previousDateTime: string | null;
        nextDateTime: string | null;
      } => Boolean(item)
    );
}

function getNotificationMetadataRows(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const record = metadata as Record<string, unknown>;
  const preferredLabels: Array<[string, string]> = [
    ["appointmentCode", "Atendimento"],
    ["customerName", "Cliente"],
    ["phone", "Telefone"],
    ["serviceName", "Servico"],
    ["date", "Data"],
    ["time", "Horario"],
    ["previousDateTime", "Horario antigo"],
    ["nextDateTime", "Novo horario"],
    ["reason", "Motivo"],
    ["rating", "Nota"],
    ["reviewComment", "Comentario"],
    ["openAppointments", "Em aberto"],
    ["appointmentCount", "Atendimentos"],
  ];

  return preferredLabels
    .map(([key, label]) => {
      const value = record[key];

      if (value === null || value === undefined || value === "") {
        return null;
      }

      return {
        label,
        value: String(value),
      };
    })
    .filter((row): row is { label: string; value: string } => Boolean(row));
}

function NotificationDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <span className="max-w-[62%] text-right font-bold text-white">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  className = "",
  children,
}: {
  href: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)] ${className}`}
    >
      <span className="h-4 w-4 text-[var(--brand-strong)] [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3.5">
      <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        <span className="h-4 w-4 shrink-0 text-[var(--brand-strong)] [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <p
        title={value}
        className="mt-3 min-w-0 truncate text-xl font-bold text-white tabular-nums"
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-zinc-400">{helper}</p>
    </div>
  );
}
