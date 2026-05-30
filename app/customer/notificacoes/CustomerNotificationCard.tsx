"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { markCustomerNotificationReadAction } from "../notificationActions";

type NotificationMetadata = Record<string, unknown>;

export type CustomerNotificationView = {
  id: string;
  eyebrow: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
};

export default function CustomerNotificationCard({
  notification,
}: {
  notification: CustomerNotificationView;
}) {
  const [isRead, setIsRead] = useState(Boolean(notification.readAt));
  const [isOpen, setIsOpen] = useState(false);
  const [, startTransition] = useTransition();
  const metadata = getMetadata(notification.metadata);
  const appointment = getAppointmentCard(metadata);
  const eyebrow = formatNotificationText(notification.eyebrow || "Notificação");
  const title = formatNotificationText(notification.title);
  const body = formatNotificationText(notification.body);
  const createdAt = new Date(notification.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function openNotification() {
    setIsOpen(true);

    if (isRead) {
      return;
    }

    setIsRead(true);
    startTransition(() => {
      void markCustomerNotificationReadAction(notification.id);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openNotification}
        className={`w-full rounded-[18px] border px-4 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:border-[var(--brand)]/45 ${
          isRead
            ? "border-white/[0.06] bg-black/25 opacity-70"
            : "border-white/12 bg-[#0b1220]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-strong)]">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-white">
              {title}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-zinc-400">
              {body}
            </p>
            <p className="mt-2 text-[11px] text-zinc-500">
              Recebida em {createdAt}
            </p>
          </div>
          {!isRead ? (
            <span className="shrink-0 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-black text-white">
              Novo
            </span>
          ) : null}
        </div>
      </button>

      {isOpen ? (
        <NotificationDialog
          eyebrow={eyebrow}
          title={title}
          body={body}
          createdAt={createdAt}
          actionUrl={notification.actionUrl}
          appointment={appointment}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

function NotificationDialog({
  eyebrow,
  title,
  body,
  createdAt,
  actionUrl,
  appointment,
  onClose,
}: {
  eyebrow: string;
  title: string;
  body: string;
  createdAt: string;
  actionUrl: string | null;
  appointment: AppointmentCard | null;
  onClose: () => void;
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="flex max-h-[calc(100svh-32px)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#050b16] text-white shadow-[0_24px_90px_rgba(0,0,0,0.65)]">
        <div className="shrink-0 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--brand-strong)]">
                {eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-tight">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
              <p className="mt-3 text-xs text-zinc-500">Recebida em {createdAt}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar notificação"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {appointment ? (
            <AppointmentDetails appointment={appointment} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
              {body}
            </div>
          )}
        </div>

        <div className="grid shrink-0 gap-2 border-t border-white/10 bg-[#050b16] p-5 pt-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.04]"
          >
            Voltar
          </button>
          <Link
            href={actionUrl || "/customer/agendamentos"}
            onClick={onClose}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
          >
            Abrir agendamentos
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

type AppointmentCard = {
  appointmentCode: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  reason: string | null;
};

function AppointmentDetails({ appointment }: { appointment: AppointmentCard }) {
  const status = getStatusView(appointment.status);

  return (
    <div
      className={`relative overflow-hidden rounded-[20px] border ${status.cardBorder} bg-black/25 p-4`}
    >
      <span
        className={`absolute right-4 top-4 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${status.badgeClass}`}
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
        <p className="mt-1 truncate text-xs text-zinc-500">
          {appointment.barberName}
        </p>
      </div>

      {appointment.reason ? (
        <div className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-100">
            Motivo do cancelamento
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-red-50">
            {appointment.reason}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function getAppointmentCard(metadata: NotificationMetadata | null): AppointmentCard | null {
  if (!metadata) {
    return null;
  }

  const appointmentCode = asString(metadata.appointmentCode);
  const serviceName = asString(metadata.serviceName);

  if (!appointmentCode && !serviceName) {
    return null;
  }

  return {
    appointmentCode: appointmentCode || "Agendamento",
    barberName: asString(metadata.barberName) || "Barbeiro",
    serviceName: serviceName || "Serviço agendado",
    date: asString(metadata.date) || "Data",
    time: asString(metadata.time) || "Horário",
    status:
      asString(metadata.status) ||
      (asString(metadata.reason) ? "CANCELLED" : "CONFIRMED"),
    reason: asString(metadata.reason) || null,
  };
}

function getMetadata(metadata: unknown): NotificationMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as NotificationMetadata;
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

  if (
    normalized.includes("CONCL") ||
    normalized === "COMPLETED" ||
    normalized === "DONE"
  ) {
    return {
      label: "Concluído",
      cardBorder: "border-emerald-300/15",
      badgeClass: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100",
    };
  }

  if (normalized.includes("LEMBRETE")) {
    return {
      label: "Lembrete",
      cardBorder: "border-[var(--brand-strong)]/20",
      badgeClass:
        "border-[var(--brand-strong)]/45 bg-[var(--brand-muted)] text-[var(--brand-strong)]",
    };
  }

  return {
    label: "Agendado",
    cardBorder: "border-white/10",
    badgeClass:
      "border-[var(--brand-strong)]/45 bg-[var(--brand-muted)] text-[var(--brand-strong)]",
  };
}

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function formatNotificationText(value: string) {
  return value
    .replaceAll("Notificacao", "Notificação")
    .replaceAll("Notificacoes", "Notificações")
    .replaceAll("notificacao", "notificação")
    .replaceAll("notificacoes", "notificações")
    .replaceAll("Atendimento concluido", "Atendimento concluído")
    .replaceAll("concluido", "concluído")
    .replaceAll("avaliacoes", "avaliações")
    .replaceAll("experiencia", "experiência")
    .replaceAll("horario", "horário")
    .replaceAll("Horario", "Horário")
    .replaceAll("esta", "está")
    .replaceAll("Servico", "Serviço")
    .replaceAll("servico", "serviço")
    .replaceAll("Voce", "Você");
}
