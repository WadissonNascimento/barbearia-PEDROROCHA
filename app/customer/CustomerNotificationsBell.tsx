"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Bell, MailOpen, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { markCustomerNotificationReadAction } from "./notificationActions";

type CustomerNotificationItem = {
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

export default function CustomerNotificationsBell({
  notifications,
  buttonClassName,
  showButton = true,
}: {
  notifications: CustomerNotificationItem[];
  buttonClassName?: string;
  showButton?: boolean;
}) {
  const [localNotifications, setLocalNotifications] =
    useState<CustomerNotificationItem[]>(notifications);
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
      void markCustomerNotificationReadAction(notificationId);
    });
  }

  return (
    <>
      {showButton ? (
        <button
          type="button"
          aria-label="Notificacoes"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className={[
            "relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/20 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[var(--brand-strong)]/40 hover:bg-[var(--brand)]/10 hover:text-white",
            buttonClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-center text-[10px] font-black text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      ) : null}

      {selectedNotification ? (
        <CustomerNotificationDetailDialog
          notification={selectedNotification}
          onBack={() => {
            setSelectedId(null);
            setIsOpen(true);
          }}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {isOpen ? (
        <CustomerNotificationsDialog
          notifications={notificationItems}
          onClose={() => setIsOpen(false)}
          onSelect={handleSelect}
        />
      ) : null}
    </>
  );
}

function CustomerNotificationsDialog({
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
            <h2 className="mt-2 text-2xl font-bold">Central do cliente</h2>
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

function CustomerNotificationDetailDialog({
  notification,
  onBack,
  onClose,
}: {
  notification: NotificationViewItem;
  onBack: () => void;
  onClose: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const card = getAppointmentCard(notification.metadata);
  const metadataRows = getMetadataRows(notification.metadata);

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
          {card ? (
            <CustomerAppointmentNotificationCard appointment={card} />
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

function CustomerAppointmentNotificationCard({
  appointment,
}: {
  appointment: {
    appointmentCode: string;
    barberName: string;
    serviceName: string;
    date: string;
    time: string;
    status: string;
    reason: string | null;
  };
}) {
  const status = getStatusView(appointment.status);
  const metaParts = [appointment.barberName].filter(Boolean);

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
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
          {appointment.appointmentCode}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
          {appointment.date}
        </p>
        <p className="text-2xl font-bold text-white">{appointment.time}</p>
        <p className="mt-2 truncate text-base font-semibold text-white">
          {appointment.serviceName}
        </p>
        {metaParts.length > 0 ? (
          <p className="mt-1 truncate text-xs text-zinc-500">
            {metaParts.join(" - ")}
          </p>
        ) : null}
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

function getAppointmentCard(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const appointmentCode = asString(record.appointmentCode);
  const serviceName = asString(record.serviceName);

  if (!appointmentCode && !serviceName) {
    return null;
  }

  return {
    appointmentCode: appointmentCode || "Agendamento",
    barberName: asString(record.barberName) || "Barbeiro",
    serviceName: serviceName || "Servico agendado",
    date: asString(record.date) || "Data",
    time: asString(record.time) || "Horario",
    status: asString(record.status) || inferStatusFromMetadata(record),
    reason: asString(record.reason) || null,
  };
}

function inferStatusFromMetadata(record: Record<string, unknown>) {
  const reason = asString(record.reason);
  if (reason) {
    return "CANCELLED";
  }
  return "CONFIRMED";
}

function getStatusView(status: string) {
  const normalized = status.toUpperCase();

  if (normalized.includes("CANCEL")) {
    return {
      label: "Cancelado",
      cardBorder: "border-red-300/15",
      badgeClass: "border-red-300/35 bg-red-500/10 text-red-100",
    };
  }

  if (normalized.includes("CONCL") || normalized === "COMPLETED" || normalized === "DONE") {
    return {
      label: "Concluido",
      cardBorder: "border-emerald-300/15",
      badgeClass: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100",
    };
  }

  if (normalized.includes("LEMBRETE")) {
    return {
      label: "Lembrete",
      cardBorder: "border-[var(--brand-strong)]/20",
      badgeClass: "border-[var(--brand-strong)]/45 bg-[var(--brand-muted)] text-[var(--brand-strong)]",
    };
  }

  return {
    label: "Agendado",
    cardBorder: "border-white/10",
    badgeClass: "border-[var(--brand-strong)]/45 bg-[var(--brand-muted)] text-[var(--brand-strong)]",
  };
}

function getMetadataRows(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const record = metadata as Record<string, unknown>;
  const labels: Array<[string, string]> = [
    ["appointmentCode", "Agendamento"],
    ["barberName", "Barbeiro"],
    ["serviceName", "Servico"],
    ["date", "Data"],
    ["time", "Horario"],
    ["reason", "Motivo"],
  ];

  return labels
    .map(([key, label]) => {
      const value = record[key];
      if (value === null || value === undefined || value === "") {
        return null;
      }
      return { label, value: String(value) };
    })
    .filter((row): row is { label: string; value: string } => Boolean(row));
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

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
