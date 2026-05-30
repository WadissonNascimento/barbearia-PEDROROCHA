"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FeedbackMessage from "@/components/FeedbackMessage";
import { normalizeProductImageUrl } from "@/lib/productImageUrl";
import {
  getExtraCategoryLabel,
} from "@/lib/extraCategories";
import { sanitizeTextareaInput } from "@/lib/inputSanitization";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type BarberOption = {
  id: string;
  name: string | null;
  image: string | null;
  phone: string | null;
};

type ServiceOption = {
  id: string;
  barberId: string | null;
  name: string;
  price: number;
  duration: number;
  bufferAfter: number;
};

type BookingClientProps = {
  barbers: BarberOption[];
  services: ServiceOption[];
  extras: ProductExtraOption[];
  initialDate: string;
  nextDays: string[];
  whatsappNumber: string;
  rescheduleAppointment?: RescheduleAppointmentOption | null;
};

type RescheduleAppointmentOption = {
  id: string;
  appointmentCode: string;
  barberId: string;
  serviceIds: string[];
  date: string;
  time: string;
  extras: Array<{
    extraProductId: string;
    quantity: number;
  }>;
};

type ProductExtraOption = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  stock: number;
  imageUrl: string | null;
};

type PeriodSlots = {
  morning: string[];
  afternoon: string[];
  night: string[];
};

type AvailabilityPayload = {
  isDayAvailable: boolean;
  periodSlots: PeriodSlots;
};

type AvailabilityCacheEntry = {
  expiresAt: number;
  data: AvailabilityPayload;
};

type BookingDetails = {
  mode: "create" | "reschedule";
  appointmentCode: string | null;
  date: string;
  time: string;
  barberName: string;
  barberPhone: string | null;
  serviceNames: string[];
  extras: Array<{
    name: string;
    quantity: number;
    subtotal: number;
  }>;
  duration: number;
  servicePrice: number;
  extrasPrice: number;
  totalPrice: number;
};

function formatShortDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return {
    weekday,
    day,
  };
}

function getLocalBarberImage(image: string | null) {
  return image?.startsWith("/") ? image : null;
}

function emptyPeriodSlots(): PeriodSlots {
  return {
    morning: [],
    afternoon: [],
    night: [],
  };
}

function removeSlotFromPeriods(periods: PeriodSlots, slot: string): PeriodSlots {
  return {
    morning: periods.morning.filter((value) => value !== slot),
    afternoon: periods.afternoon.filter((value) => value !== slot),
    night: periods.night.filter((value) => value !== slot),
  };
}

export default function BookingClient({
  barbers,
  services,
  extras,
  initialDate,
  nextDays,
  whatsappNumber,
  rescheduleAppointment = null,
}: BookingClientProps) {
  const isRescheduling = Boolean(rescheduleAppointment);
  const rescheduleAppointmentId = rescheduleAppointment?.id;
  const [selectedBarberId, setSelectedBarberId] = useState(
    () => rescheduleAppointment?.barberId || barbers[0]?.id || ""
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    () => rescheduleAppointment?.serviceIds || []
  );
  const [selectedDate, setSelectedDate] = useState(
    () => rescheduleAppointment?.date || initialDate
  );
  const [periodSlots, setPeriodSlots] = useState<PeriodSlots>({
    morning: [],
    afternoon: [],
    night: [],
  });
  const [isDayAvailable, setIsDayAvailable] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);
  const [extrasSlot, setExtrasSlot] = useState<string | null>(null);
  const [confirmationSlot, setConfirmationSlot] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const availabilityCacheRef = useRef<Map<string, AvailabilityCacheEntry>>(new Map());
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (rescheduleAppointment?.extras || []).map((extra) => [
        extra.extraProductId,
        extra.quantity,
      ])
    )
  );

  const visibleServices = useMemo(
    () =>
      selectedBarberId
        ? services.filter(
            (service) => service.barberId === null || service.barberId === selectedBarberId
          )
        : [],
    [selectedBarberId, services]
  );

  const selectedServices = useMemo(
    () => visibleServices.filter((service) => selectedServiceIds.includes(service.id)),
    [selectedServiceIds, visibleServices]
  );

  const selectedBarber = useMemo(
    () => barbers.find((barber) => barber.id === selectedBarberId),
    [barbers, selectedBarberId]
  );

  const selectedOccupiedDuration = selectedServices.reduce(
    (sum, service) => sum + service.duration + Math.max(0, service.bufferAfter || 0),
    0
  );
  const selectedPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const selectedExtras = useMemo(
    () =>
      extras
        .map((product) => ({
          ...product,
          quantity: extraQuantities[product.id] || 0,
          imageUrl: normalizeProductImageUrl(product.imageUrl),
        }))
        .filter((product) => product.quantity > 0),
    [extraQuantities, extras]
  );
  const selectedExtrasPrice = selectedExtras.reduce(
    (sum, product) => sum + product.price * product.quantity,
    0
  );
  const selectedTotalPrice = selectedPrice + selectedExtrasPrice;
  const selectedItemsLabel =
    selectedServiceIds.length === 1
      ? "1 item selecionado"
      : `${selectedServiceIds.length} itens selecionados`;
  const showMobileContinueBar =
    selectedServiceIds.length > 0 &&
    !isScheduleModalOpen &&
    !extrasSlot &&
    !confirmationSlot &&
    !bookingSlot &&
    !bookingSuccess &&
    !bookingError;
  const totalSlots =
    periodSlots.morning.length + periodSlots.afternoon.length + periodSlots.night.length;
  const hasBookingConflict = bookingError?.toLowerCase().includes("reservado") ?? false;
  const selectedServiceKey = useMemo(
    () => [...selectedServiceIds].sort().join(","),
    [selectedServiceIds]
  );
  const availabilityKey = useMemo(
    () =>
      selectedBarberId && selectedServiceKey && selectedDate
        ? [
            selectedBarberId,
            selectedServiceKey,
            selectedDate,
            rescheduleAppointmentId || "",
          ].join("|")
        : "",
    [rescheduleAppointmentId, selectedBarberId, selectedDate, selectedServiceKey]
  );
  const groupedExtras = useMemo(() => {
    const categories = ["BEVERAGE", "SHELF", "OTHER"] as const;

    return categories
      .map((category) => ({
        category,
        title: getExtraCategoryLabel(category),
        items: extras.filter((product) => product.category === category),
      }))
      .filter((group) => group.items.length > 0);
  }, [extras]);

  useEffect(() => {
    setSelectedServiceIds((current) =>
      current.filter((serviceId) =>
        visibleServices.some((service) => service.id === serviceId)
      )
    );
    setBookingError(null);
    setBookingSuccess(null);
    setBookingDetails(null);
  }, [visibleServices]);

  const loadAvailability = useCallback(
    async (signal?: AbortSignal, options: { force?: boolean } = {}) => {
      if (!availabilityKey || !selectedBarberId || selectedServiceIds.length === 0 || !selectedDate) {
        setPeriodSlots(emptyPeriodSlots());
        setIsDayAvailable(false);
        setAvailabilityError(null);
        return;
      }

      const cached = availabilityCacheRef.current.get(availabilityKey);

      if (!options.force && cached && cached.expiresAt > Date.now()) {
        setIsDayAvailable(cached.data.isDayAvailable);
        setPeriodSlots(cached.data.periodSlots);
        setAvailabilityError(null);
        return;
      }

      setAvailabilityLoading(true);
      setAvailabilityError(null);

      try {
        const response = await fetch("/api/booking/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            barberId: selectedBarberId,
            serviceIds: selectedServiceIds,
            date: selectedDate,
            rescheduleAppointmentId,
          }),
          signal,
        });

        const data = (await response.json()) as {
          message?: string;
          isDayAvailable?: boolean;
          periodSlots?: PeriodSlots;
        };

        if (!response.ok) {
          throw new Error(data.message || "Não foi possível carregar os horários.");
        }

        setIsDayAvailable(Boolean(data.isDayAvailable));
        const nextPayload = {
          isDayAvailable: Boolean(data.isDayAvailable),
          periodSlots: data.periodSlots || emptyPeriodSlots(),
        };

        availabilityCacheRef.current.set(availabilityKey, {
          data: nextPayload,
          expiresAt: Date.now() + 20_000,
        });

        setPeriodSlots(nextPayload.periodSlots);
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        setIsDayAvailable(false);
        setPeriodSlots(emptyPeriodSlots());
        setAvailabilityError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os horários."
        );
      } finally {
        if (!signal?.aborted) {
          setAvailabilityLoading(false);
        }
      }
    },
    [availabilityKey, rescheduleAppointmentId, selectedBarberId, selectedDate, selectedServiceIds]
  );

  useEffect(() => {
    if (!selectedBarberId || selectedServiceIds.length === 0 || !selectedDate) {
      setPeriodSlots(emptyPeriodSlots());
      setIsDayAvailable(false);
      setAvailabilityError(null);
      setIsScheduleModalOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadAvailability(controller.signal);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadAvailability, selectedBarberId, selectedDate, selectedServiceIds]);

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
    setBookingError(null);
    setBookingSuccess(null);
    setBookingDetails(null);
  }

  function openBookingConfirmation(time: string) {
    setBookingError(null);
    setBookingSuccess(null);
    setExtrasSlot(time);
  }

  function openMobileScheduleModal() {
    setBookingError(null);
    setIsScheduleModalOpen(true);
  }

  function selectMobileScheduleSlot(time: string) {
    setIsScheduleModalOpen(false);
    openBookingConfirmation(time);
  }

  function proceedFromExtrasToSummary() {
    if (!extrasSlot) {
      return;
    }

    setConfirmationSlot(extrasSlot);
    setExtrasSlot(null);
  }

  function updateExtraQuantity(productId: string, nextQuantity: number, stock: number) {
    setExtraQuantities((current) => {
      const boundedQuantity = Math.max(0, Math.min(stock, nextQuantity));

      if (boundedQuantity === 0) {
        const { [productId]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [productId]: boundedQuantity,
      };
    });
  }

  async function bookAppointment(time: string, notes = "") {
    setExtrasSlot(null);
    setConfirmationSlot(null);
    setBookingSlot(time);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const response = await fetch("/api/booking/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barberId: selectedBarberId,
          serviceIds: selectedServiceIds,
          extras: selectedExtras.map((product) => ({
            extraProductId: product.id,
            quantity: product.quantity,
          })),
          date: selectedDate,
          time,
          notes: sanitizeTextareaInput(notes, 50),
          rescheduleAppointmentId,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        appointmentCode?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "Não foi possível concluir o agendamento.");
      }

      setBookingSuccess(
        data.message ||
          (isRescheduling
            ? "Agendamento remarcado com sucesso."
            : "Agendamento realizado com sucesso.")
      );
      setBookingDetails({
        mode: isRescheduling ? "reschedule" : "create",
        appointmentCode: data.appointmentCode || null,
        date: selectedDate,
        time,
        barberName: selectedBarber?.name || "Barbeiro",
        barberPhone: selectedBarber?.phone || null,
        serviceNames: selectedServices.map((service) => service.name),
        extras: selectedExtras.map((product) => ({
          name: product.name,
          quantity: product.quantity,
          subtotal: product.price * product.quantity,
        })),
        duration: selectedOccupiedDuration,
        servicePrice: selectedPrice,
        extrasPrice: selectedExtrasPrice,
        totalPrice: selectedTotalPrice,
      });
      setBookingSlot(null);

      setPeriodSlots((current) => {
        const nextPeriods = removeSlotFromPeriods(current, time);
        const hasRemainingSlots =
          nextPeriods.morning.length + nextPeriods.afternoon.length + nextPeriods.night.length > 0;

        if (availabilityKey) {
          availabilityCacheRef.current.set(availabilityKey, {
            data: {
              isDayAvailable: hasRemainingSlots,
              periodSlots: nextPeriods,
            },
            expiresAt: Date.now() + 20_000,
          });
        }

        setIsDayAvailable(hasRemainingSlots);
        return nextPeriods;
      });
    } catch (error) {
      setBookingError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o agendamento."
      );
      void loadAvailability(undefined, { force: true });
    } finally {
      setBookingSlot(null);
    }
  }

  return (
    <div
      className={`page-shell max-w-5xl overflow-x-hidden text-white ${
        showMobileContinueBar ? "pb-28 md:pb-0" : ""
      }`}
    >
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
            {isRescheduling ? "Remarcar horário" : "Agendar horário"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            {isRescheduling
              ? "Escolha o novo horário. Ao confirmar, o horário antigo fica livre automaticamente."
              : "Escolha o serviço e toque em um horário disponível."}
          </p>
          {isRescheduling ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
              Remarcando {rescheduleAppointment?.appointmentCode}
            </p>
          ) : null}
        </div>

      </div>

      <section className="surface-card max-w-full overflow-hidden rounded-[20px] p-3 sm:rounded-[24px] sm:p-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-200">
                Barbeiro
              </label>
              <div className="grid max-h-[128px] max-w-full grid-cols-2 gap-2 overflow-y-auto pr-1 sm:max-h-none sm:grid-cols-3 sm:overflow-visible sm:pr-0">
                {barbers.map((barber) => {
                  const checked = selectedBarberId === barber.id;
                  const imageSrc = getLocalBarberImage(barber.image);

                  return (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => {
                        setSelectedBarberId(barber.id);
                        setBookingError(null);
                        setBookingSuccess(null);
                        setBookingDetails(null);
                      }}
                      className={`min-w-0 rounded-xl border px-2.5 py-2 text-left transition sm:w-full sm:px-3 ${
                        checked
                          ? "border-[var(--brand)] bg-[var(--brand-muted)] text-white shadow-[0_18px_36px_rgba(14,165,233,0.18)]"
                          : "border-white/10 bg-black/20 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-sky-500/30 via-white/10 to-black/20 text-sm font-bold text-[var(--brand-strong)] sm:h-11 sm:w-11"
                        >
                          {imageSrc ? (
                            <Image
                              src={imageSrc}
                              alt={barber.name || "Barbeiro"}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          ) : (
                            (barber.name || "B").slice(0, 1)
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold sm:text-sm">
                            {barber.name}
                          </span>
                          {checked ? (
                            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
                              Selecionado
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedBarber ? (
                <div className="hidden sm:block">
                  <BarberProfileStrip
                    barber={selectedBarber}
                    servicesCount={visibleServices.length}
                  />
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-200">
                Serviços
              </label>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {visibleServices.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-zinc-500 sm:col-span-2">
                    Escolha o barbeiro para liberar os serviços.
                  </p>
                ) : (
                  visibleServices.map((service) => {
                    const checked = selectedServiceIds.includes(service.id);

                    return (
                      <label
                        key={service.id}
                        className={`flex min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 transition sm:px-4 sm:py-3 ${
                          checked
                            ? "border-[var(--brand)] bg-[var(--brand-muted)] text-white"
                            : "border-white/10 bg-black/20 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(service.id)}
                          className="sr-only"
                        />
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-semibold">{service.name}</p>
                          <p className="mt-1 truncate text-xs text-zinc-400">
                            {formatCurrency(service.price)} - {service.duration} min
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="hidden md:block">
              <label className="mb-2 block text-sm font-semibold text-zinc-200">
                Data
              </label>
              <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
                {nextDays.map((day) => {
                  const isSelected = day === selectedDate;
                  const { weekday, day: dayLabel } = formatShortDate(day);
                  const disabled = !selectedBarberId || selectedServiceIds.length === 0;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedDate(day)}
                      className={`min-w-[82px] rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--brand-muted)]"
                          : "border-white/10 bg-black/20 hover:border-white/20"
                      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {weekday}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">{dayLabel}</p>
                    </button>
                  );
                })}
              </div>

              {(!selectedBarberId || selectedServiceIds.length === 0) && (
                <p className="mt-3 text-xs text-zinc-500">
                  Escolha barbeiro e serviços para liberar a agenda.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card mt-3 hidden max-w-full overflow-hidden rounded-[20px] p-3 sm:mt-4 sm:rounded-[24px] sm:p-5 md:block">
          <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">Horários disponíveis</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {selectedDate
                  ? `Escolha um horário para ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString("pt-BR")}.`
                  : "Escolha um dia para continuar."}
              </p>
            </div>

            {selectedServices.length > 0 && (
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 sm:px-4 sm:py-3">
                Total atual - {formatCurrency(selectedTotalPrice)}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <FeedbackMessage message={availabilityError} tone="error" />
            <FeedbackMessage
              message={hasBookingConflict ? null : bookingError}
              tone="error"
            />
          </div>

          {!selectedBarberId || selectedServiceIds.length === 0 || !selectedDate ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-400">
              Escolha barbeiro, serviço e data para ver os horários livres.
            </div>
          ) : availabilityLoading ? (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 px-4 py-6 text-sm text-zinc-300">
              Buscando os melhores horários para esse atendimento...
            </div>
          ) : !isDayAvailable ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-400">
              Esse barbeiro não possui horário ativo nesse dia. Tente outra data.
            </div>
          ) : (
            <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-3">
              <TimeSection
                title="Manha"
                slots={periodSlots.morning}
                bookingSlot={bookingSlot}
                onBook={openBookingConfirmation}
              />

              <TimeSection
                title="Tarde"
                slots={periodSlots.afternoon}
                bookingSlot={bookingSlot}
                onBook={openBookingConfirmation}
              />

              <TimeSection
                title="Noite"
                slots={periodSlots.night}
                bookingSlot={bookingSlot}
                onBook={openBookingConfirmation}
              />
            </div>
          )}
      </section>

      {isScheduleModalOpen ? (
        <BookingScheduleModal
          nextDays={nextDays}
          selectedDate={selectedDate}
          selectedBarberId={selectedBarberId}
          selectedServiceIds={selectedServiceIds}
          selectedTotalPrice={selectedTotalPrice}
          availabilityError={availabilityError}
          bookingError={hasBookingConflict ? null : bookingError}
          availabilityLoading={availabilityLoading}
          isDayAvailable={isDayAvailable}
          periodSlots={periodSlots}
          bookingSlot={bookingSlot}
          onSelectDate={setSelectedDate}
          onBook={selectMobileScheduleSlot}
          onClose={() => setIsScheduleModalOpen(false)}
        />
      ) : null}

      {showMobileContinueBar ? (
        <MobileBookingContinueBar
          selectedItemsLabel={selectedItemsLabel}
          totalPrice={selectedTotalPrice}
          onContinue={openMobileScheduleModal}
        />
      ) : null}

      {extrasSlot ? (
        <BookingExtrasDialog
          groupedExtras={groupedExtras}
          selectedExtras={selectedExtras.map((product) => ({
            name: product.name,
            quantity: product.quantity,
          }))}
          extraQuantities={extraQuantities}
          onUpdateExtraQuantity={updateExtraQuantity}
          onCancel={() => setExtrasSlot(null)}
          onContinue={proceedFromExtrasToSummary}
        />
      ) : null}

      {confirmationSlot ? (
        <BookingConfirmationDialog
          time={confirmationSlot}
          date={selectedDate}
          barberName={selectedBarber?.name || "Barbeiro"}
          services={selectedServices.map((service) => service.name)}
          extras={selectedExtras.map((product) => ({
            name: product.name,
            quantity: product.quantity,
            subtotal: product.price * product.quantity,
          }))}
          duration={selectedOccupiedDuration}
          servicePrice={selectedPrice}
          extrasPrice={selectedExtrasPrice}
          totalPrice={selectedTotalPrice}
          isRescheduling={isRescheduling}
          isSubmitting={bookingSlot === confirmationSlot}
          onCancel={() => setConfirmationSlot(null)}
          onConfirm={(notes) => void bookAppointment(confirmationSlot, notes)}
        />
      ) : null}

      {bookingSlot ? (
        <BookingLoadingOverlay isRescheduling={isRescheduling} />
      ) : null}

      {bookingSuccess && bookingDetails ? (
        <BookingSuccessDialog
          details={bookingDetails}
          whatsappNumber={whatsappNumber}
        />
      ) : null}

      {bookingError ? (
        <BookingErrorDialog
          message={
            hasBookingConflict
              ? "Esse horário acabou de ser reservado por outro cliente. Escolha outro horário livre para continuar."
              : bookingError
          }
          onReschedule={() => {
            setBookingError(null);
            void loadAvailability(undefined, { force: true });
          }}
        />
      ) : null}

    </div>
  );
}

function BookingLoadingOverlay({ isRescheduling }: { isRescheduling: boolean }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={isRescheduling ? "Remarcando agendamento" : "Confirmando agendamento"}
    >
      <div className="flex w-full max-w-xs flex-col items-center rounded-3xl border border-white/10 bg-[#050b16]/95 p-6 text-center text-white shadow-[0_24px_90px_rgba(0,0,0,0.65)]">
        <span className="h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-[var(--brand)]" />
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
          {isRescheduling ? "Remarcando" : "Confirmando"}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Aguarde enquanto salvamos seu horario.
        </p>
      </div>
    </div>,
    document.body
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white">{value}</p>
    </div>
  );
}

function MobileBookingContinueBar({
  selectedItemsLabel,
  totalPrice,
  onContinue,
}: {
  selectedItemsLabel: string;
  totalPrice: number;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[9000] border-t border-white/10 bg-[#050b16]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 text-white shadow-[0_-16px_50px_rgba(0,0,0,0.45)] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            {selectedItemsLabel}
          </p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(totalPrice)}</p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="shrink-0 rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(14,165,233,0.28)] transition hover:brightness-110"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function BookingScheduleModal({
  nextDays,
  selectedDate,
  selectedBarberId,
  selectedServiceIds,
  selectedTotalPrice,
  availabilityError,
  bookingError,
  availabilityLoading,
  isDayAvailable,
  periodSlots,
  bookingSlot,
  onSelectDate,
  onBook,
  onClose,
}: {
  nextDays: string[];
  selectedDate: string;
  selectedBarberId: string;
  selectedServiceIds: string[];
  selectedTotalPrice: number;
  availabilityError: string | null;
  bookingError: string | null;
  availabilityLoading: boolean;
  isDayAvailable: boolean;
  periodSlots: PeriodSlots;
  bookingSlot: string | null;
  onSelectDate: (date: string) => void;
  onBook: (slot: string) => void;
  onClose: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end bg-black/75 px-3 pb-3 pt-10 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-schedule-title"
    >
      <div className="max-h-[calc(100svh-24px)] w-full overflow-hidden rounded-[26px] border border-white/10 bg-[#050b16] text-white shadow-[0_24px_80px_rgba(0,0,0,0.62)] sm:mx-auto sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Proximo passo
            </p>
            <h2 id="booking-schedule-title" className="mt-1 text-xl font-bold sm:text-2xl">
              Escolha data e horario
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Total atual - {formatCurrency(selectedTotalPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl text-zinc-200 transition hover:bg-white/10"
            aria-label="Fechar escolha de horario"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(100svh-150px)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <label className="mb-2 block text-sm font-semibold text-zinc-200">
            Data
          </label>
          <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
            {nextDays.map((day) => {
              const isSelected = day === selectedDate;
              const { weekday, day: dayLabel } = formatShortDate(day);
              const disabled = !selectedBarberId || selectedServiceIds.length === 0;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectDate(day)}
                  className={`min-w-[82px] rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-[var(--brand)] bg-[var(--brand-muted)]"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    {weekday}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{dayLabel}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold">Horarios disponiveis</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedDate
                    ? `Escolha um horario para ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString("pt-BR")}.`
                    : "Escolha um dia para continuar."}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <FeedbackMessage message={availabilityError} tone="error" />
              <FeedbackMessage message={bookingError} tone="error" />
            </div>

            {!selectedBarberId || selectedServiceIds.length === 0 || !selectedDate ? (
              <div className="mt-5 rounded-[22px] border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-400">
                Escolha barbeiro, servico e data para ver os horarios livres.
              </div>
            ) : availabilityLoading ? (
              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-300">
                Buscando os melhores horarios para esse atendimento...
              </div>
            ) : !isDayAvailable ? (
              <div className="mt-5 rounded-[22px] border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-400">
                Esse barbeiro nao possui horario ativo nesse dia. Tente outra data.
              </div>
            ) : (
              <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-3">
                <TimeSection
                  title="Manha"
                  slots={periodSlots.morning}
                  bookingSlot={bookingSlot}
                  onBook={onBook}
                />

                <TimeSection
                  title="Tarde"
                  slots={periodSlots.afternoon}
                  bookingSlot={bookingSlot}
                  onBook={onBook}
                />

                <TimeSection
                  title="Noite"
                  slots={periodSlots.night}
                  bookingSlot={bookingSlot}
                  onBook={onBook}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TimeSection({
  title,
  slots,
  bookingSlot,
  onBook,
}: {
  title: string;
  slots: string[];
  bookingSlot: string | null;
  onBook: (slot: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white sm:text-lg">{title}</h3>
        <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 sm:tracking-[0.18em]">
          {slots.length} disponíveis
        </span>
      </div>

      {slots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-zinc-500">
          Sem horários livres nesse período. Tente outro período ou outro dia.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              disabled={Boolean(bookingSlot)}
              onClick={() => onBook(slot)}
              className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)] disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:py-3"
            >
              {bookingSlot === slot ? "Reservando..." : slot}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BarberProfileStrip({
  barber,
  servicesCount,
}: {
  barber: BarberOption;
  servicesCount: number;
}) {
  const imageSrc = getLocalBarberImage(barber.image);

  return (
    <div className="mt-3 flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-sky-500/30 via-white/10 to-black/20 text-sm font-bold text-[var(--brand-strong)]"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={barber.name || "Barbeiro"}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          (barber.name || "B").slice(0, 1)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          {barber.name || "Barbeiro"}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-strong)]">
          {servicesCount} serviço(s) disponíveis
        </p>
      </div>
    </div>
  );
}

function BookingErrorDialog({
  message,
  onReschedule,
}: {
  message: string;
  onReschedule: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-error-title"
    >
      <div className="max-h-[calc(100svh-32px)] w-full max-w-md overflow-y-auto rounded-2xl border border-red-500/30 bg-[#050b16] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 text-red-200">
          <span className="text-sm font-bold">!</span>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-red-200">
            Não foi possível agendar
          </p>
          <h2 id="booking-error-title" className="mt-2 text-2xl font-bold">
            Horário indisponível
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{message}</p>
        </div>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={onReschedule}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Reagendar em outro horário
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Sair para tela inicial
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BookingSummary({
  barberName,
  services,
  extras,
  date,
  duration,
  servicePrice,
  extrasPrice,
  totalPrice,
  totalSlots,
}: {
  barberName: string;
  services: string[];
  extras: Array<{
    name: string;
    quantity: number;
    subtotal: number;
  }>;
  date: string;
  duration: number;
  servicePrice: number;
  extrasPrice: number;
  totalPrice: number;
  totalSlots: number;
}) {
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div className="rounded-[24px] border border-[var(--brand)]/25 bg-[var(--brand-muted)]/40 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-strong)]">
        Resumo
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <ConfirmationRow label="Barbeiro" value={barberName} />
        <ConfirmationRow
          label="Lista de serviços"
          value={services.length ? services.join(", ") : "Nenhum serviço"}
        />
        <ConfirmationRow
          label="Lista de extras"
          value={
            extras.length
              ? extras.map((item) => `${item.name} x${item.quantity}`).join(", ")
              : "Nenhum extra"
          }
        />
        <ConfirmationRow label="Data" value={formattedDate} />
        <ConfirmationRow label="Duração" value={duration ? `${duration} min` : "-"} />
        <ConfirmationRow
          label="Serviços"
          value={servicePrice ? formatCurrency(servicePrice) : "-"}
        />
        <ConfirmationRow
          label="Extras"
          value={extrasPrice ? formatCurrency(extrasPrice) : "R$ 0,00"}
        />
        <ConfirmationRow
          label="Total"
          value={totalPrice ? formatCurrency(totalPrice) : "-"}
        />
        <ConfirmationRow
          label="Horários"
          value={services.length ? `${totalSlots} disponíveis` : "Aguardando"}
        />
      </div>
    </div>
  );
}

function BookingSuccessDialog({
  details,
  whatsappNumber,
}: {
  details: BookingDetails;
  whatsappNumber: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const formattedDate = new Date(`${details.date}T00:00:00`).toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    }
  );
  const isRescheduled = details.mode === "reschedule";
  const whatsappMessage =
    `Ola! Acabei de ${isRescheduled ? "remarcar" : "agendar"} meu horário para ${formattedDate} as ${details.time} com ${details.barberName}.`
  ;
  const contactNumber = details.barberPhone || whatsappNumber;
  const whatsappHref = buildWhatsAppUrl(contactNumber, whatsappMessage);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-success-title"
    >
      <div className="max-h-[calc(100svh-32px)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--brand)]/30 bg-[#050b16] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-muted)] text-[var(--brand-strong)] ring-1 ring-[var(--brand)]/30">
          <span className="text-sm font-bold">OK</span>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-strong)]">
            {isRescheduled ? "Agendamento remarcado" : "Agendamento realizado"}
          </p>
          <h2 id="booking-success-title" className="mt-2 text-2xl font-bold">
            {isRescheduled ? "Horário atualizado" : "Horário reservado"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {isRescheduled
              ? "O horário antigo foi liberado e sua agenda já está atualizada."
              : "Chegue 5 minutos antes do horário para garantir um atendimento tranquilo."}
          </p>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
          {details.appointmentCode ? (
            <ConfirmationRow label="Agendamento" value={details.appointmentCode} />
          ) : null}
          <ConfirmationRow label="Data" value={formattedDate} />
          <ConfirmationRow label="Horário" value={details.time} />
          <ConfirmationRow label="Barbeiro" value={details.barberName} />
          <ConfirmationRow label="Serviços" value={details.serviceNames.join(", ")} />
          <ConfirmationRow
            label="Extras"
            value={
              details.extras.length
                ? details.extras.map((item) => `${item.name} x${item.quantity}`).join(", ")
                : "Nenhum extra"
            }
          />
          <ConfirmationRow label="Serviços" value={formatCurrency(details.servicePrice)} />
          <ConfirmationRow label="Extras" value={formatCurrency(details.extrasPrice)} />
          <ConfirmationRow label="Total" value={formatCurrency(details.totalPrice)} />
        </div>

        <div className="mt-5 grid gap-3">
          <Link
            href="/customer/agendamentos"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Ver meus agendamentos
          </Link>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/35 bg-[#25D366]/10 px-4 py-3 text-sm font-semibold text-[#9ff0bd] transition hover:bg-[#25D366]/15"
            >
              <WhatsAppIcon />
              Falar no WhatsApp
            </a>
          ) : null}
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Página inicial
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BookingExtrasDialog({
  groupedExtras,
  selectedExtras,
  extraQuantities,
  onUpdateExtraQuantity,
  onCancel,
  onContinue,
}: {
  groupedExtras: Array<{
    category: string;
    title: string;
    items: ProductExtraOption[];
  }>;
  selectedExtras: Array<{
    name: string;
    quantity: number;
  }>;
  extraQuantities: Record<string, number>;
  onUpdateExtraQuantity: (productId: string, nextQuantity: number, stock: number) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-extras-title"
    >
      <div className="max-h-[calc(100svh-24px)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#050b16] p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]">
          Adicionar extras
        </p>
        <h2 id="booking-extras-title" className="mt-1 text-xl font-bold sm:mt-2 sm:text-2xl">
          Deseja retirar algo no local?
        </h2>
        <p className="mt-1 text-sm leading-5 text-zinc-400 sm:mt-2 sm:leading-6">
          Escolha uma bebida ou algum produto para retirar durante seu atendimento.
        </p>

        <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-3 sm:mt-5 sm:p-4">
          {groupedExtras.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-zinc-500">
              Nenhum extra disponível no momento.
            </p>
          ) : (
            <div className="max-h-[38svh] space-y-4 overflow-y-auto overflow-x-hidden pr-1 sm:max-h-[420px] sm:space-y-5">
              {groupedExtras.map((group) => (
                <div
                  key={group.category}
                  className="space-y-2 sm:space-y-3"
                >
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
                          group.category === "BEVERAGE"
                            ? "text-sky-200"
                            : group.category === "SHELF"
                              ? "text-violet-200"
                              : "text-zinc-400"
                        }`}
                      >
                        {group.category === "BEVERAGE"
                          ? "BEBIDAS"
                          : group.category === "SHELF"
                            ? "PRODUTOS PARA CUIDADO"
                            : group.title.toUpperCase()}
                      </p>
                      <div
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          group.category === "BEVERAGE"
                            ? "border-sky-400/25 bg-sky-400/10 text-sky-200"
                            : group.category === "SHELF"
                              ? "border-violet-400/25 bg-violet-400/10 text-violet-200"
                              : "border-white/10 bg-white/[0.05] text-zinc-300"
                        }`}
                      >
                        {group.items.length} item(ns)
                      </div>
                    </div>
                    <p className="text-xs leading-4 text-zinc-400 sm:leading-5">
                      {group.category === "BEVERAGE"
                        ? "Geladas para retirada no atendimento."
                        : group.category === "SHELF"
                          ? "Somente para retirada no local."
                          : "Itens adicionais disponíveis para esse horário."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((product) => {
                      const quantity = extraQuantities[product.id] || 0;
                      const productImageUrl = normalizeProductImageUrl(product.imageUrl);

                      return (
                        <div
                          key={product.id}
                          className="rounded-[20px] border border-white/10 bg-[#0f1724]/90 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#edf1f7] shadow-[0_12px_24px_rgba(0,0,0,0.18)] sm:h-[62px] sm:w-[62px] sm:rounded-[18px]">
                              {productImageUrl ? (
                                <Image
                                  src={productImageUrl}
                                  alt={product.name}
                                  fill
                                  sizes="62px"
                                  className="object-contain"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-zinc-500">
                                  Sem imagem
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold leading-5 text-white break-words sm:text-[15px]">
                                  {product.name}
                                </p>
                                <p className="text-sm font-semibold text-white">
                                  {formatCurrency(product.price)}
                                </p>
                                {product.description ? (
                                  <p className="line-clamp-1 text-xs leading-4 text-zinc-400 sm:line-clamp-2 sm:leading-5">
                                    {product.description}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2 rounded-[18px] border border-white/10 bg-black/20 px-2.5 py-2 sm:mt-3 sm:px-3">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateExtraQuantity(
                                  product.id,
                                  quantity - 1,
                                  product.stock
                                )
                              }
                              disabled={quantity === 0}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-lg font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
                            >
                              -
                            </button>
                            <div className="min-w-0 flex-1 text-center">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                                Quantidade
                              </p>
                              <p className="mt-0.5 text-base font-bold text-white sm:mt-1 sm:text-lg">{quantity}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateExtraQuantity(
                                  product.id,
                                  quantity + 1,
                                  product.stock
                                )
                              }
                              disabled={quantity >= product.stock}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-lg font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 sm:mt-4 sm:py-3">
          {selectedExtras.length > 0
            ? `Selecionado: ${selectedExtras.map((item) => `${item.name} x${item.quantity}`).join(", ")}`
            : "Nenhum extra selecionado."}
        </div>

        <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {selectedExtras.length > 0 ? "Continuar com extras" : "Continuar sem extras"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 448 512"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 1.9 131.6 1.9 254c0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7C49.1 322.8 39.4 288.9 39.4 254c0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.5-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.5-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.6-6.6z" />
    </svg>
  );
}

function BookingConfirmationDialog({
  time,
  date,
  barberName,
  services,
  extras,
  duration,
  servicePrice,
  extrasPrice,
  totalPrice,
  isRescheduling,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  time: string;
  date: string;
  barberName: string;
  services: string[];
  extras: Array<{
    name: string;
    quantity: number;
    subtotal: number;
  }>;
  duration: number;
  servicePrice: number;
  extrasPrice: number;
  totalPrice: number;
  isRescheduling: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [notes, setNotes] = useState("");
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-confirmation-title"
    >
      <div className="max-h-[calc(100svh-32px)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#050b16] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]">
          {isRescheduling ? "Confirmar remarcação" : "Confirmar agendamento"}
        </p>
        <h2 id="booking-confirmation-title" className="mt-2 text-2xl font-bold">
          Esta tudo certo?
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {isRescheduling
            ? "Confira os dados antes de atualizar o horário."
            : "Confira os dados antes de reservar esse horário."}
        </p>

        <div className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-strong)]">
            Resumo
          </p>
          <ConfirmationRow label="Data" value={formattedDate} />
          <ConfirmationRow label="Horário" value={time} />
          <ConfirmationRow label="Barbeiro" value={barberName} />
          <ConfirmationRow label="Serviços" value={services.join(", ")} />
          <ConfirmationRow
            label="Extras"
            value={
              extras.length
                ? extras.map((item) => `${item.name} x${item.quantity}`).join(", ")
                : "Nenhum extra"
            }
          />
          <ConfirmationRow label="Duração" value={`${duration} min`} />
          <ConfirmationRow label="Serviços" value={formatCurrency(servicePrice)} />
          <ConfirmationRow label="Extras" value={formatCurrency(extrasPrice)} />
          <ConfirmationRow label="Total" value={formatCurrency(totalPrice)} />
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-white">
            Observação para o barbeiro
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 50))}
            disabled={isSubmitting}
            rows={3}
            maxLength={50}
            placeholder="Ex: prefiro acabamento mais baixo, tenho sensibilidade na pele..."
            className="mt-2 min-h-[96px] w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="mt-2 block text-right text-xs text-zinc-500">
            {notes.length}/50
          </span>
        </label>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Revisar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes)}
            disabled={isSubmitting}
            className="rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Confirmando..."
              : isRescheduling
              ? "Confirmar remarcação"
              : "Confirmar agendamento"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConfirmationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className="max-w-[220px] text-right font-semibold text-white">{value}</span>
    </div>
  );
}
