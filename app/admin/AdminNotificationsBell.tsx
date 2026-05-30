"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Bell, MailOpen, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { markAdminNotificationReadAction } from "./notificationActions";

type AdminNotificationItem = {
  id: string;
  type: string;
  eyebrow: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
};

type NotificationViewItem = {
  id: string;
  eyebrow: string;
  title: string;
  preview: string;
  body: string;
  actionUrl: string | null;
  metadata: unknown;
  createdAt: string;
  isNew: boolean;
};

export default function AdminNotificationsBell({
  notifications,
}: {
  notifications: AdminNotificationItem[];
}) {
  const [localNotifications, setLocalNotifications] =
    useState<AdminNotificationItem[]>(notifications);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const didOpenNotificationsFromQuery = useRef(false);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    if (
      searchParams.get("notifications") === "1" &&
      !didOpenNotificationsFromQuery.current
    ) {
      didOpenNotificationsFromQuery.current = true;
      setSelectedId(null);
      setIsOpen(true);
    }

    if (searchParams.get("notifications") !== "1") {
      didOpenNotificationsFromQuery.current = false;
    }
  }, [searchParams]);

  const notificationItems = useMemo(
    () =>
      localNotifications.map((notification) => ({
        id: notification.id,
        eyebrow: notification.eyebrow || "Notificacao",
        title: notification.title,
        preview: notification.body,
        body: notification.body,
        actionUrl: notification.actionUrl,
        metadata: notification.metadata,
        createdAt: new Date(notification.createdAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        isNew: !notification.readAt,
      })),
    [localNotifications]
  );
  const unreadCount = notificationItems.filter((item) => item.isNew).length;
  const selectedNotification =
    notificationItems.find((item) => item.id === selectedId) || null;

  function handleSelect(notificationId: string) {
    setSelectedId(notificationId);
    setIsOpen(false);
    setLocalNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: notification.readAt || new Date() }
          : notification
      )
    );
    startTransition(() => {
      void markAdminNotificationReadAction(notificationId);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Notificacoes"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/20 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[var(--brand-strong)]/40 hover:bg-[var(--brand)]/10 hover:text-white"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-center text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {selectedNotification ? (
        <AdminNotificationDetailDialog
          notification={selectedNotification}
          onBack={() => {
            setSelectedId(null);
            setIsOpen(true);
          }}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {isOpen ? (
        <AdminNotificationsDialog
          notifications={notificationItems}
          onClose={() => setIsOpen(false)}
          onSelect={handleSelect}
        />
      ) : null}
    </>
  );
}

function AdminNotificationsDialog({
  notifications,
  onClose,
  onSelect,
}: {
  notifications: Pick<
    NotificationViewItem,
    "id" | "eyebrow" | "title" | "preview" | "isNew"
  >[];
  onClose: () => void;
  onSelect: (notificationId: string) => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
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
            <h2 className="mt-2 text-2xl font-bold">Central do admin</h2>
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

function AdminNotificationDetailDialog({
  notification,
  onBack,
  onClose,
}: {
  notification: NotificationViewItem;
  onBack: () => void;
  onClose: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const metadataRows = getMetadataRows(notification.metadata);
  const appointmentCards = getAppointmentCards(notification.metadata);
  const extraCards = getExtraCards(notification.metadata);
  const dailySummary = getDailySummary(notification.metadata);

  useEffect(() => {
    setIsMounted(true);
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
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
              <p className="mt-2 text-sm text-zinc-400">{notification.body}</p>
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
          {dailySummary ? (
            <AdminDailySummaryCard summary={dailySummary} />
          ) : appointmentCards.length > 0 ? (
            <div className="space-y-3">
              {appointmentCards.map((appointment) => (
                <AdminAppointmentNotificationCard
                  key={appointment.appointmentCode}
                  appointment={appointment}
                />
              ))}
            </div>
          ) : extraCards.length > 0 ? (
            <div className="space-y-3">
              {extraCards.map((extra) => (
                <div
                  key={extra.id || extra.name}
                  className="rounded-[22px] border border-white/10 bg-[#0b1220] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
                    Estoque baixo
                  </p>
                  <p className="mt-1 text-lg font-black text-white">{extra.name}</p>
                  <p className="mt-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
                    {extra.stock} unidade(s) em estoque
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm">
              <DetailRow label="Recebida" value={notification.createdAt} />
              {metadataRows.map((row) => (
                <DetailRow key={row.label} label={row.label} value={row.value} />
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

function AdminAppointmentNotificationCard({
  appointment,
}: {
  appointment: {
    appointmentCode: string;
    customerName: string;
    barberName: string;
    phone: string | null;
    serviceName: string;
    date: string;
    time: string;
    status: string;
    reason: string | null;
  };
}) {
  const status = getAppointmentStatusView(appointment.status);
  const metaParts = [appointment.barberName, appointment.phone].filter(Boolean);

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border ${status.cardBorder} bg-black/25 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)]`}
    >
      <span
        className={`absolute right-4 top-4 w-fit max-w-[130px] shrink-0 rounded-full border px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-[0.14em] ${status.badgeClass}`}
      >
        {status.label}
      </span>

      <div className="min-w-0 pr-28">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            {appointment.appointmentCode}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
            {appointment.date}
          </p>
          <p className="text-2xl font-bold text-white">{appointment.time}</p>
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

function AdminDailySummaryCard({
  summary,
}: {
  summary: {
    date: string;
    totalAppointments: string;
    completedAppointments: string;
    cancelledAppointments: string;
    noShowAppointments: string;
    revenue: string;
  };
}) {
  return (
    <div className="rounded-[24px] border border-[var(--brand)]/20 bg-[#0b1220] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            Resumo do dia
          </p>
          <p className="mt-1 text-xl font-black text-white">{summary.date}</p>
        </div>
        <div className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--brand-strong)]">
            Faturamento
          </p>
          <p className="mt-1 text-lg font-black text-white">{summary.revenue}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <CompactInfo label="Total" value={summary.totalAppointments} />
        <CompactInfo label="Concluidos" value={summary.completedAppointments} />
        <CompactInfo label="Cancelados" value={summary.cancelledAppointments} />
        <CompactInfo label="Faltas" value={summary.noShowAppointments} />
      </div>
    </div>
  );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}

function getAppointmentCards(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const record = metadata as Record<string, unknown>;
  const appointments = Array.isArray(record.appointments)
    ? record.appointments
    : [record];
  const shouldKeepOnlyOpenAppointments = Array.isArray(record.appointments);

  return appointments
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const appointment = item as Record<string, unknown>;
      const appointmentCode = asString(appointment.appointmentCode);
      const customerName = asString(appointment.customerName);

      if (!appointmentCode && !customerName) {
        return null;
      }

      const status = asString(appointment.status) || "CONFIRMED";

      if (shouldKeepOnlyOpenAppointments && !isOpenAppointmentStatus(status)) {
        return null;
      }

      return {
        appointmentCode: appointmentCode || "Atendimento",
        customerName: customerName || "Cliente",
        barberName: asString(appointment.barberName) || "Barbeiro",
        phone: asString(appointment.phone) || null,
        serviceName: asString(appointment.serviceName) || "Servico agendado",
        date: asString(appointment.date) || "Nao informado",
        time: asString(appointment.time) || "Horario",
        status,
        reason: asString(appointment.reason) || null,
      };
    })
    .filter(
      (item): item is {
        appointmentCode: string;
        customerName: string;
        barberName: string;
        phone: string | null;
        serviceName: string;
        date: string;
        time: string;
        status: string;
        reason: string | null;
      } => Boolean(item)
    );
}

function getDailySummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  if (
    record.totalAppointments === undefined &&
    record.completedAppointments === undefined &&
    record.revenue === undefined
  ) {
    return null;
  }

  return {
    date: formatSummaryDate(asString(record.date) || "Hoje"),
    totalAppointments: asString(record.totalAppointments) || "0",
    completedAppointments: asString(record.completedAppointments) || "0",
    cancelledAppointments: asString(record.cancelledAppointments) || "0",
    noShowAppointments: asString(record.noShowAppointments) || "0",
    revenue: formatCurrencyValue(record.revenue),
  };
}

function isOpenAppointmentStatus(status: string) {
  return ["CONFIRMED", "SCHEDULED", "AGENDADO"].includes(status.toUpperCase());
}

function getAppointmentStatusView(status: string) {
  const normalized = status.toUpperCase();

  if (["CANCELLED", "CANCELED", "CANCELADO"].includes(normalized)) {
    return {
      label: "Cancelado",
      cardBorder: "border-red-300/15",
      badgeClass: "border-red-300/35 bg-red-500/10 text-red-100",
    };
  }

  if (["NO_SHOW", "FALTOU", "FALTA"].includes(normalized)) {
    return {
      label: "Faltou",
      cardBorder: "border-amber-300/15",
      badgeClass: "border-amber-300/35 bg-amber-400/10 text-amber-100",
    };
  }

  return {
    label: "Agendado",
    cardBorder: "border-white/10",
    badgeClass: "border-[var(--brand-strong)]/45 bg-[var(--brand-muted)] text-[var(--brand-strong)]",
  };
}

function formatSummaryDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return value;
}

function formatCurrencyValue(value: unknown) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  const text = asString(value);
  if (!text) {
    return "R$ 0,00";
  }

  const numeric = Number(text);
  if (!Number.isNaN(numeric) && !text.includes("R$")) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numeric);
  }

  return text;
}

function getExtraCards(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const extras = (metadata as Record<string, unknown>).extras;

  if (!Array.isArray(extras)) {
    return [];
  }

  return extras
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;

      return {
        id: asString(record.id),
        name: asString(record.name) || "Extra",
        stock: asString(record.stock) || "0",
      };
    })
    .filter((item): item is { id: string; name: string; stock: string } =>
      Boolean(item)
    );
}

function getMetadataRows(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const record = metadata as Record<string, unknown>;
  const labels: Array<[string, string]> = [
    ["appointmentCode", "Atendimento"],
    ["customerName", "Cliente"],
    ["phone", "Telefone"],
    ["serviceName", "Servico"],
    ["date", "Data"],
    ["time", "Horario"],
    ["reason", "Motivo"],
    ["rating", "Nota"],
    ["reviewComment", "Comentario"],
    ["totalAppointments", "Total"],
    ["completedAppointments", "Concluidos"],
    ["cancelledAppointments", "Cancelados"],
    ["noShowAppointments", "Faltas"],
    ["revenue", "Faturamento"],
    ["openAppointments", "Em aberto"],
    ["threshold", "Limite do alerta"],
  ];

  return labels
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

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <span className="max-w-[62%] text-right font-bold text-white">{value}</span>
    </div>
  );
}
