"use client";

import { useEffect, useState, type ReactNode } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  normalizeAppointmentStatus,
} from "@/lib/appointmentStatus";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { formatAppointmentPublicId } from "@/lib/appointmentPublicId";
import { formatScheduleDate, formatScheduleTime } from "@/lib/scheduleTime";
import { getManualFitInVisibleNotes } from "@/lib/manualFitIn";

export type BarberAppointmentCardItem = {
  id: string;
  extraProductId?: string;
  productNameSnapshot: string;
  quantity: number;
  isDelivered: boolean;
  deliveredAt: Date | string | null;
};

export type BarberAppointmentCardData = {
  id: string;
  publicId: number;
  date: Date;
  status: string;
  paymentMethod?: string | null;
  isManualFitIn: boolean;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  serviceName: string;
  serviceMeta: string;
  services?: Array<{
    serviceId: string;
    nameSnapshot: string;
    priceSnapshot: number;
    durationSnapshot: number;
    orderIndex: number;
  }>;
  items: BarberAppointmentCardItem[];
};

export type BarberAppointmentItemDeliveryDecision = {
  appointmentItemId: string;
  isDelivered: boolean;
};

export type BarberAppointmentDeliveryReview = {
  hasPickupItems: boolean;
  allPickupItemsReviewed: boolean;
  itemDeliveryDecisions: BarberAppointmentItemDeliveryDecision[];
};

type BarberAppointmentCardProps = {
  appointment: BarberAppointmentCardData;
  actions: (review: BarberAppointmentDeliveryReview) => ReactNode;
  highlighted?: boolean;
  showDate?: boolean;
  contactHref?: string | null;
};

function formatCardDate(date: Date) {
  return formatScheduleDate(new Date(date), {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatCardTime(date: Date) {
  return formatScheduleTime(new Date(date));
}

export default function BarberAppointmentCard({
  appointment,
  actions,
  highlighted = false,
  showDate = false,
  contactHref,
}: BarberAppointmentCardProps) {
  const [items, setItems] = useState(appointment.items);
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleNotes = appointment.isManualFitIn
    ? getManualFitInVisibleNotes(appointment.notes)
    : appointment.notes;
  const hasPickupItems = items.length > 0;
  const reviewedPickupItems = items.filter((item) => item.deliveredAt);
  const deliveredPickupItems = items.filter((item) => item.isDelivered);
  const allPickupItemsReviewed =
    !hasPickupItems || reviewedPickupItems.length === items.length;
  const canReviewPickupItems = ["PENDING", "CONFIRMED"].includes(
    appointment.status
  );
  const pickupStatusLabel = allPickupItemsReviewed
    ? `${deliveredPickupItems.length}/${items.length} entregues`
    : `${reviewedPickupItems.length}/${items.length} marcadas`;
  const itemDeliveryDecisions = reviewedPickupItems.map((item) => ({
    appointmentItemId: item.id,
    isDelivered: item.isDelivered,
  }));
  const actionContent = actions({
    hasPickupItems,
    allPickupItemsReviewed,
    itemDeliveryDecisions,
  });

  useEffect(() => {
    setItems(appointment.items);
  }, [appointment.items]);

  function reviewItem(item: BarberAppointmentCardItem, isDelivered: boolean) {
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              isDelivered,
              deliveredAt: new Date().toISOString(),
            }
          : currentItem
      )
    );
  }

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
      className={`relative max-w-full cursor-pointer overflow-hidden rounded-[24px] border p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)] transition ${
        highlighted
          ? "border-white/20 bg-[linear-gradient(145deg,rgba(20,24,34,0.96),rgba(8,12,20,0.98))]"
          : "border-white/10 bg-black/25"
      }`}
    >
      {highlighted ? (
        <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-strong)]/70 to-transparent" />
      ) : null}

      <StatusBadge
        variant={appointmentStatusVariant(appointment.status)}
        className="absolute right-4 top-4 w-fit max-w-[130px] shrink-0 justify-center px-2.5 py-1 text-[10px]"
      >
        {appointmentStatusLabel(appointment.status)}
      </StatusBadge>
      {normalizeAppointmentStatus(appointment.status) === "COMPLETED" ? (
        <span className="absolute right-4 top-12 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">
          {paymentMethodLabel(appointment.paymentMethod)}
        </span>
      ) : null}

      <div className="min-w-0 pr-28">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            {formatAppointmentPublicId(appointment.publicId)}
          </p>
          {appointment.isManualFitIn ? (
            <span className="mt-2 inline-flex w-fit rounded-full border border-sky-300/25 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200">
              Encaixe manual
            </span>
          ) : null}
          {showDate ? (
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
              {formatCardDate(appointment.date)}
            </p>
          ) : null}
          <p className="text-2xl font-bold text-white">
            {formatCardTime(appointment.date)}
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <p className="block min-w-0 truncate text-base font-semibold text-white">
              {appointment.customer.name}
            </p>
            {contactHref ? <WhatsAppShortcut href={contactHref} /> : null}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {appointment.serviceName}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {appointment.serviceMeta}
          </p>
        </div>
      </div>

      {isExpanded ? (
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
      {hasPickupItems ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
              Os seguintes itens foram entregues?
            </p>
            <StatusBadge variant={allPickupItemsReviewed ? "success" : "warning"}>
              {pickupStatusLabel}
            </StatusBadge>
          </div>

          <div className="mt-2 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-white">
                    {item.productNameSnapshot}
                  </span>
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[var(--brand-strong)]">
                    x{item.quantity}
                  </span>
                </div>

                {canReviewPickupItems ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <DeliveryButton
                      item={item}
                      isDelivered
                      onSelect={reviewItem}
                    >
                      Sim
                    </DeliveryButton>
                    <DeliveryButton
                      item={item}
                      isDelivered={false}
                      onSelect={reviewItem}
                    >
                      Não
                    </DeliveryButton>
                  </div>
                ) : item.deliveredAt ? (
                  <p className="mt-2 text-xs font-semibold text-zinc-400">
                    {item.isDelivered ? "Entregue" : "Não entregue"}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {!allPickupItemsReviewed && canReviewPickupItems ? (
            <p className="mt-2 text-xs leading-5 text-amber-200">
              Marque os itens antes de concluir o atendimento.
            </p>
          ) : null}
        </div>
      ) : null}

      {visibleNotes ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
            Observação
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-zinc-200">
            {visibleNotes}
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        {actionContent}
      </div>
        </div>
      ) : null}
    </article>
  );
}

function DeliveryButton({
  item,
  isDelivered,
  children,
  onSelect,
}: {
  item: BarberAppointmentCardItem;
  isDelivered: boolean;
  children: ReactNode;
  onSelect: (item: BarberAppointmentCardItem, isDelivered: boolean) => void;
}) {
  const isSelected = Boolean(item.deliveredAt) && item.isDelivered === isDelivered;
  const selectedClasses = isDelivered
    ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100"
    : "border-amber-400/45 bg-amber-400/10 text-amber-100";

  return (
    <button
      type="button"
      onClick={() => onSelect(item, isDelivered)}
      className={`min-h-9 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
        isSelected
          ? selectedClasses
          : "border-white/10 bg-white/[0.035] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

function WhatsAppShortcut({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chamar cliente no WhatsApp"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-500/15 text-emerald-100 shadow-[0_10px_24px_rgba(34,197,94,0.16)] transition hover:scale-105 hover:bg-emerald-500 hover:text-white"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-4 w-4"
        fill="currentColor"
      >
        <path d="M16.04 4C9.4 4 4 9.4 4 16.04c0 2.12.56 4.18 1.62 6L4 28l6.12-1.6a12 12 0 0 0 5.92 1.52C22.68 27.92 28 22.6 28 15.96 28 9.36 22.64 4 16.04 4Zm0 21.88a9.86 9.86 0 0 1-5.04-1.38l-.36-.22-3.64.96.98-3.54-.24-.38a9.88 9.88 0 1 1 18.16-5.36 9.86 9.86 0 0 1-9.86 9.92Zm5.42-7.38c-.3-.16-1.76-.86-2.04-.96-.28-.1-.48-.16-.68.16-.2.3-.78.96-.96 1.16-.18.2-.36.22-.66.08-.3-.16-1.26-.46-2.4-1.48-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.14-.62.14-.14.3-.36.46-.54.16-.18.2-.30.3-.5.1-.2.04-.38-.02-.54-.08-.16-.68-1.64-.94-2.24-.24-.58-.5-.5-.68-.5h-.58c-.2 0-.52.08-.8.38-.28.3-1.04 1.02-1.04 2.48s1.06 2.88 1.22 3.08c.16.2 2.1 3.2 5.08 4.48.7.3 1.26.48 1.7.62.72.22 1.36.18 1.86.12.58-.08 1.76-.72 2-1.42.24-.7.24-1.3.18-1.42-.08-.12-.28-.2-.58-.36Z" />
      </svg>
    </a>
  );
}
