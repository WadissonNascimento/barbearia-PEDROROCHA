"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Scissors,
  X,
} from "lucide-react";
import OperationalFeedbackDialog, {
  type OperationalFeedbackState,
} from "@/components/ui/OperationalFeedbackDialog";
import {
  isValidCustomerFullName,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";
import { formatBrazilianPhone, isValidBrazilianPhone, maskBrazilianPhone } from "@/lib/phone";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";
import {
  createAdminWalkInAppointmentAction,
  getAdminQuickFitInPreviewAction,
  getAdminWalkInAvailableSlotsAction,
} from "./actions";
import type {
  AdminAgendaBarber,
  AdminAgendaExtra,
  AdminAgendaService,
} from "./AdminAgendaClient";

type WalkInStep =
  | "customer"
  | "services"
  | "mode"
  | "schedule"
  | "quickDuration"
  | "extras"
  | "summary";

type FitInMode = "standard" | "quick";

type QuickFitInPreview = {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  conflict: {
    appointmentId: string;
    publicId: number;
    customerName: string;
    startTime: string;
    endTime: string;
  } | null;
};

type PeriodSlots = {
  morning: string[];
  afternoon: string[];
  night: string[];
};

type PendingSummary = {
  customerName: string;
  customerPhone: string;
  serviceName: string;
  extrasLabel: string;
  date: string;
  startTime: string;
  notes: string;
};

const emptyPeriodSlots = (): PeriodSlots => ({
  morning: [],
  afternoon: [],
  night: [],
});

function getAdminWalkInDateOptions() {
  const todayValue = getCurrentScheduleDateValue();
  const [year, month, day] = todayValue.split("-").map(Number);
  const today = new Date(year, month - 1, day);

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const value = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      value,
      weekday: date
        .toLocaleDateString("pt-BR", { weekday: "short" })
        .replace(".", ""),
      label: date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
    };
  });
}

function formatDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value || "-";
  }

  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminWalkInAppointmentButton({
  barbers,
  services,
  extras,
  selectedBarberId,
  selectedDate,
}: {
  barbers: AdminAgendaBarber[];
  services: AdminAgendaService[];
  extras: AdminAgendaExtra[];
  selectedBarberId: string;
  selectedDate: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isQuickConflictOpen, setIsQuickConflictOpen] = useState(false);
  const [step, setStep] = useState<WalkInStep>("customer");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [date, setDate] = useState(selectedDate || getCurrentScheduleDateValue());
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [fitInMode, setFitInMode] = useState<FitInMode>("standard");
  const [quickDurationMinutes, setQuickDurationMinutes] = useState("20");
  const [quickPreview, setQuickPreview] = useState<QuickFitInPreview | null>(null);
  const [hasExtras, setHasExtras] = useState(false);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [periodSlots, setPeriodSlots] = useState<PeriodSlots>(emptyPeriodSlots);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [slotsFeedback, setSlotsFeedback] = useState<{
    message: string;
    tone: "info" | "error";
  }>({
    message: "Selecione os servicos para ver os horarios disponiveis.",
    tone: "info",
  });
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [successDetails, setSuccessDetails] = useState<PendingSummary | null>(null);
  const [actionFeedback, setActionFeedback] =
    useState<OperationalFeedbackState>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const [isQuickPreviewLoading, setIsQuickPreviewLoading] = useState(false);

  const selectedBarber = useMemo(
    () => barbers.find((barber) => barber.id === selectedBarberId) || null,
    [barbers, selectedBarberId]
  );
  const availableServices = useMemo(
    () =>
      services.filter(
        (service) =>
          !selectedBarberId ||
          service.barberId === selectedBarberId ||
          service.barberId === null
      ),
    [selectedBarberId, services]
  );
  const selectedServices = useMemo(
    () =>
      availableServices.filter((service) =>
        selectedServiceIds.includes(service.id)
      ),
    [availableServices, selectedServiceIds]
  );
  const selectedExtras = useMemo(
    () =>
      hasExtras
        ? extras.filter((extra) => selectedExtraIds.includes(extra.id))
        : [],
    [extras, hasExtras, selectedExtraIds]
  );
  const selectedDuration = selectedServices.reduce(
    (total, service) => total + service.duration,
    0
  );
  const selectedTotal = selectedServices.reduce(
    (total, service) => total + service.price,
    0
  );
  const selectedExtrasTotal = selectedExtras.reduce(
    (total, extra) => total + extra.price,
    0
  );
  const selectedGrandTotal = selectedTotal + selectedExtrasTotal;
  const activeDuration =
    fitInMode === "quick" ? Number(quickDurationMinutes) || 0 : selectedDuration;
  const hasCustomerMinimum =
    isValidCustomerFullName(customerName) &&
    (!customerPhone.trim() || isValidBrazilianPhone(customerPhone));
  const dateOptions = useMemo(() => getAdminWalkInDateOptions(), []);
  const isCreating = isPending || isSubmitLocked;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDate(selectedDate || getCurrentScheduleDateValue());
  }, [selectedDate]);

  useEffect(() => {
    setSelectedServiceIds((currentIds) =>
      currentIds.filter((serviceId) =>
        services.some(
          (service) =>
            service.id === serviceId &&
            (service.barberId === selectedBarberId || service.barberId === null)
        )
      )
    );
    setStartTime("");
    setAvailableSlots([]);
    setPeriodSlots(emptyPeriodSlots());
  }, [selectedBarberId, services]);

  useEffect(() => {
    if (!mounted || (!isOpen && !isSuccessOpen && !isQuickConflictOpen)) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isOpen, isQuickConflictOpen, isSuccessOpen, mounted]);

  useEffect(() => {
    if (!isOpen || step !== "schedule") {
      return;
    }

    if (!selectedBarberId || !date || selectedServiceIds.length === 0) {
      setAvailableSlots([]);
      setPeriodSlots(emptyPeriodSlots());
      setStartTime("");
      setSlotsFeedback({
        message: "Selecione os servicos para ver os horarios disponiveis.",
        tone: "info",
      });
      setIsLoadingSlots(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSlots(true);
    setSlotsFeedback({
      message: "Carregando horarios disponiveis...",
      tone: "info",
    });

    getAdminWalkInAvailableSlotsAction({
      barberId: selectedBarberId,
      date,
      serviceIds: selectedServiceIds,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setAvailableSlots([]);
          setPeriodSlots(emptyPeriodSlots());
          setStartTime("");
          setSlotsFeedback({
            message: result.message,
            tone: "error",
          });
          return;
        }

        const nextPeriodSlots = result.data?.periodSlots || emptyPeriodSlots();
        const nextSlots = result.data?.slots || [
          ...nextPeriodSlots.morning,
          ...nextPeriodSlots.afternoon,
          ...nextPeriodSlots.night,
        ];

        setPeriodSlots(nextPeriodSlots);
        setAvailableSlots(nextSlots);
        setStartTime((current) => (nextSlots.includes(current) ? current : ""));
        setSlotsFeedback({
          message:
            nextSlots.length > 0
              ? "Toque em um horario para reservar o encaixe."
              : "Nenhum horario disponivel para essa data e duracao.",
          tone: nextSlots.length > 0 ? "info" : "error",
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAvailableSlots([]);
        setPeriodSlots(emptyPeriodSlots());
        setStartTime("");
        setSlotsFeedback({
          message: "Nao foi possivel carregar os horarios. Tente novamente.",
          tone: "error",
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSlots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [date, isOpen, selectedBarberId, selectedServiceIds, step]);

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setSelectedServiceIds([]);
    setFitInMode("standard");
    setQuickDurationMinutes("20");
    setQuickPreview(null);
    setHasExtras(false);
    setSelectedExtraIds([]);
    setNotes("");
    setPeriodSlots(emptyPeriodSlots());
    setAvailableSlots([]);
    setStartTime("");
    setIsQuickConflictOpen(false);
    setFeedback({ message: null, tone: "success" });
    setActionFeedback(null);
    setStep("customer");
  }

  function openWalkInModal() {
    if (!selectedBarberId) {
      return;
    }

    resetForm();
    setDate(selectedDate || getCurrentScheduleDateValue());
    setIsOpen(true);
  }

  function closeModal() {
    if (isCreating) {
      return;
    }

    setIsOpen(false);
    setIsQuickConflictOpen(false);
    setQuickPreview(null);
    setFeedback({ message: null, tone: "success" });
    setActionFeedback(null);
  }

  function showWalkInError(title: string, message: string) {
    setFeedback({ message, tone: "error" });
    setActionFeedback({ title, message, tone: "error" });
  }

  function goToServicesStep() {
    const normalizedName = normalizeCustomerName(customerName);
    const hasPhone = Boolean(customerPhone.trim());

    setCustomerName(normalizedName);

    if (!isValidCustomerFullName(normalizedName)) {
      showWalkInError(
        "Confira o cliente",
        "Informe nome e sobrenome do cliente para criar o encaixe."
      );
      return;
    }

    if (hasPhone && !isValidBrazilianPhone(customerPhone)) {
      showWalkInError(
        "Confira o telefone",
        "O telefone e opcional, mas precisa ser valido quando for informado."
      );
      return;
    }

    setFeedback({ message: null, tone: "success" });
    setStep("services");
  }

  function goToScheduleStep() {
    if (selectedServiceIds.length === 0) {
      showWalkInError(
        "Escolha o servico",
        "Selecione pelo menos um servico para carregar os horarios disponiveis."
      );
      return;
    }

    setFeedback({ message: null, tone: "success" });
    setStep("mode");
  }

  function chooseStandardFitIn() {
    setFitInMode("standard");
    setQuickPreview(null);
    setFeedback({ message: null, tone: "success" });
    setStep("schedule");
  }

  function chooseQuickFitIn() {
    setFitInMode("quick");
    setStartTime("");
    setQuickPreview(null);
    setFeedback({ message: null, tone: "success" });
    setStep("quickDuration");
  }

  async function previewQuickFitIn() {
    const duration = Number(quickDurationMinutes);

    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      showWalkInError(
        "Confira o tempo",
        "Informe uma duracao entre 5 e 240 minutos para o encaixe rapido."
      );
      return;
    }

    setIsQuickPreviewLoading(true);
    setFeedback({ message: null, tone: "success" });

    try {
      const result = await getAdminQuickFitInPreviewAction({
        barberId: selectedBarberId,
        durationMinutes: duration,
      });

      if (!result.ok || !result.data) {
        showWalkInError(
          "Nao foi possivel calcular",
          result.message || "Tente novamente em instantes."
        );
        return;
      }

      setQuickPreview(result.data);
      setDate(result.data.date);
      setStartTime(result.data.startTime);

      if (result.data.conflict) {
        setIsQuickConflictOpen(true);
        return;
      }

      setStep("extras");
    } catch {
      showWalkInError(
        "Nao foi possivel calcular",
        "Tente novamente em instantes."
      );
    } finally {
      setIsQuickPreviewLoading(false);
    }
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((currentIds) => {
      const nextIds = currentIds.includes(serviceId)
        ? currentIds.filter((id) => id !== serviceId)
        : [...currentIds, serviceId];

      setStartTime("");
      setAvailableSlots([]);
      setPeriodSlots(emptyPeriodSlots());
      return nextIds;
    });
  }

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((currentIds) =>
      currentIds.includes(extraId)
        ? currentIds.filter((id) => id !== extraId)
        : [...currentIds, extraId]
    );
  }

  function selectWalkInSlot(slot: string) {
    setStartTime(slot);
    setFeedback({ message: null, tone: "success" });
    setStep("extras");
  }

  function submitSummary() {
    const formData = new FormData();
    const submittedCustomerName = normalizeCustomerName(customerName);
    const submittedCustomerPhone = formatBrazilianPhone(customerPhone);
    const serviceName =
      selectedServices.map((service) => service.name).join(" + ") || "Servico";
    const extrasLabel =
      hasExtras && selectedExtras.length > 0
        ? selectedExtras.map((extra) => extra.name).join(" + ")
        : "";

    if (!isValidCustomerFullName(submittedCustomerName)) {
      showWalkInError(
        "Confira o cliente",
        "Informe nome e sobrenome do cliente antes de criar o encaixe."
      );
      return;
    }

    if (customerPhone.trim() && !isValidBrazilianPhone(customerPhone)) {
      showWalkInError(
        "Confira o telefone",
        "O telefone e opcional, mas precisa ser valido quando for informado."
      );
      return;
    }

    if (fitInMode === "standard" && !availableSlots.includes(startTime)) {
      showWalkInError(
        "Escolha o horario",
        "Selecione um horario disponivel na lista antes de criar o encaixe."
      );
      return;
    }

    formData.set("barberId", selectedBarberId);
    formData.set("customerName", submittedCustomerName);
    formData.set("customerPhone", submittedCustomerPhone);
    formData.set("date", date);
    formData.set("startTime", startTime);
    formData.set("notes", notes);
    formData.set("fitInMode", fitInMode);
    formData.set("manualDurationMinutes", quickDurationMinutes);
    selectedServiceIds.forEach((serviceId) => formData.append("serviceIds", serviceId));
    if (hasExtras) {
      selectedExtraIds.forEach((extraId) => formData.append("extraProductIds", extraId));
    }

    createAdminWalkInFromSummary(formData, {
      customerName: submittedCustomerName || "Cliente",
      customerPhone: submittedCustomerPhone,
      serviceName,
      extrasLabel,
      date,
      startTime,
      notes,
    });
  }

  function createAdminWalkInFromSummary(formData: FormData, summary: PendingSummary) {
    if (isCreating) {
      return;
    }

    setIsSubmitLocked(true);

    startTransition(async () => {
      try {
        const result = await createAdminWalkInAppointmentAction(formData);

        if (result.ok) {
          setSuccessDetails(summary);
          setIsOpen(false);
          setIsSuccessOpen(true);
          resetForm();
          router.refresh();
        } else {
          setFeedback({ message: result.message, tone: result.tone });
          setActionFeedback({
            title: "Nao foi possivel criar o encaixe",
            message: result.message,
            tone: "error",
          });
        }
      } catch {
        setFeedback({
          message: "Nao foi possivel criar o encaixe. Tente novamente.",
          tone: "error",
        });
        setActionFeedback({
          title: "Erro ao criar encaixe",
          message:
            "Nao foi possivel salvar o encaixe agora. Os dados ficaram preenchidos para voce tentar novamente.",
          tone: "error",
        });
      } finally {
        setIsSubmitLocked(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openWalkInModal}
        disabled={!selectedBarberId || availableServices.length === 0}
        title={
          selectedBarberId
            ? "Agendar encaixe para o barbeiro selecionado"
            : "Selecione um barbeiro para agendar"
        }
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand)] px-4 py-3 text-sm font-black text-white shadow-[0_18px_40px_rgba(14,165,233,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-zinc-500 disabled:shadow-none sm:w-auto"
      >
        <CalendarPlus className="h-4 w-4" />
        {selectedBarber
          ? `Agendar para ${selectedBarber.name || selectedBarber.email || "barbeiro"}`
          : "Selecione um barbeiro"}
      </button>

      {mounted && isOpen
        ? createPortal(
            <ModalShell onClose={closeModal}>
              <div className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[30px] border border-white/10 bg-[#050b16] shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--brand-strong)]">
                        Encaixe admin
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                        Criar encaixe manual
                      </h2>
                      <p className="mt-1 truncate text-sm text-zinc-400">
                        {selectedBarber?.name || selectedBarber?.email || "Barbeiro selecionado"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                      aria-label="Fechar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <FeedbackMessage
                    message={feedback.tone === "error" ? feedback.message : null}
                    tone="error"
                  />

                  {availableServices.length === 0 ? (
                    <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
                      Cadastre um servico ativo para esse barbeiro antes de criar encaixes.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {step === "customer" ? (
                        <div className="space-y-4">
                          <StepTitle title="Cliente do encaixe" />

                          <div className="grid gap-3">
                            <label className="block">
                              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                Nome completo
                              </span>
                              <input
                                value={customerName}
                                onChange={(event) => setCustomerName(event.target.value)}
                                onBlur={() =>
                                  setCustomerName((current) => normalizeCustomerName(current))
                                }
                                type="text"
                                inputMode="text"
                                autoCapitalize="words"
                                autoComplete="name"
                                maxLength={80}
                                placeholder="Nome e sobrenome"
                                className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/40"
                              />
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                Telefone opcional
                              </span>
                              <input
                                value={customerPhone}
                                onChange={(event) =>
                                  setCustomerPhone(maskBrazilianPhone(event.target.value))
                                }
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                maxLength={15}
                                placeholder="(11) 96590-0713"
                                className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/40"
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={goToServicesStep}
                            disabled={!hasCustomerMinimum}
                            className="min-h-12 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Continuar
                          </button>
                        </div>
                      ) : null}

                      {step === "services" ? (
                        <div className="space-y-4">
                          <StepTitle title="Servicos" />

                          <div className="space-y-2">
                            {availableServices.map((service) => {
                              const selected = selectedServiceIds.includes(service.id);

                              return (
                                <button
                                  key={service.id}
                                  type="button"
                                  onClick={() => toggleService(service.id)}
                                  className={`flex min-h-[62px] w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                                    selected
                                      ? "border-[var(--brand)]/45 bg-[var(--brand-muted)]"
                                      : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                                  }`}
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <span
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                                        selected
                                          ? "border-[var(--brand)]/45 bg-[var(--brand)] text-white"
                                          : "border-white/10 bg-black/20 text-zinc-400"
                                      }`}
                                    >
                                      {selected ? (
                                        <Check className="h-4 w-4" />
                                      ) : (
                                        <Scissors className="h-4 w-4" />
                                      )}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-bold leading-tight text-white">
                                        {service.name}
                                      </span>
                                      <span className="mt-1 block text-xs leading-tight text-zinc-400">
                                        {service.duration} min - {formatCurrency(service.price)}
                                      </span>
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <StepActions onBack={() => setStep("customer")} />

                          {selectedServiceIds.length > 0 ? (
                            <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-white/10 bg-[#050b16]/95 p-4 backdrop-blur-xl">
                              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--brand)] px-4 py-3 text-white shadow-[0_18px_40px_rgba(14,165,233,0.25)]">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
                                    {selectedServiceIds.length} item(ns)
                                  </p>
                                  <p className="text-lg font-black">
                                    {formatCurrency(selectedGrandTotal)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={goToScheduleStep}
                                  className="min-h-10 rounded-xl bg-white px-4 py-2 text-sm font-black text-sky-600 transition hover:bg-sky-50"
                                >
                                  Continuar
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {step === "mode" ? (
                        <div className="space-y-4">
                          <StepTitle title="Tipo de encaixe" />

                          <div className="grid gap-3">
                            <button
                              type="button"
                              onClick={chooseStandardFitIn}
                              className="flex min-h-[86px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-muted)]"
                            >
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]">
                                <CheckCircle2 className="h-5 w-5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-base font-black text-white">
                                  Agendamento padrao
                                </span>
                                <span className="mt-1 block text-sm leading-5 text-zinc-400">
                                  Escolhe data e horario livre na agenda.
                                </span>
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={chooseQuickFitIn}
                              className="flex min-h-[86px] items-center gap-3 rounded-2xl border border-[var(--brand-strong)]/25 bg-[var(--brand)]/10 px-4 py-3 text-left transition hover:border-[var(--brand-strong)]/45 hover:bg-[var(--brand)]/15"
                            >
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-strong)]/30 bg-[var(--brand)]/10 text-[var(--brand-strong)]">
                                <Clock3 className="h-5 w-5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-base font-black text-white">
                                  Encaixe rapido
                                </span>
                                <span className="mt-1 block text-sm leading-5 text-zinc-400">
                                  Usa o horario atual e permite confirmar mesmo encostando em outro atendimento.
                                </span>
                              </span>
                            </button>
                          </div>

                          <StepActions onBack={() => setStep("services")} />
                        </div>
                      ) : null}

                      {step === "schedule" ? (
                        <div className="space-y-4">
                          <StepTitle title="Data e horario" />

                          <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
                            {dateOptions.map((option) => {
                              const selected = date === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setDate(option.value);
                                    setStartTime("");
                                  }}
                                  className={`min-w-[82px] rounded-2xl border px-3 py-3 text-left transition ${
                                    selected
                                      ? "border-[var(--brand)] bg-[var(--brand-muted)]"
                                      : "border-white/10 bg-black/20 hover:border-white/20"
                                  }`}
                                >
                                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                                    {option.weekday}
                                  </span>
                                  <span className="mt-1 block text-sm font-semibold text-white">
                                    {option.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white">
                                  Horarios disponiveis
                                </p>
                                <p
                                  className={`mt-1 text-xs ${
                                    slotsFeedback.tone === "error"
                                      ? "text-red-200"
                                      : "text-zinc-400"
                                  }`}
                                >
                                  {slotsFeedback.message}
                                </p>
                              </div>
                              {isLoadingSlots ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--brand-strong)]" />
                              ) : null}
                            </div>

                            {availableSlots.length > 0 ? (
                              <div className="mt-4 grid min-w-0 gap-4">
                                <TimeSection
                                  title="Manha"
                                  slots={periodSlots.morning}
                                  onSelect={selectWalkInSlot}
                                />
                                <TimeSection
                                  title="Tarde"
                                  slots={periodSlots.afternoon}
                                  onSelect={selectWalkInSlot}
                                />
                                <TimeSection
                                  title="Noite"
                                  slots={periodSlots.night}
                                  onSelect={selectWalkInSlot}
                                />
                              </div>
                            ) : null}
                          </div>

                          <StepActions onBack={() => setStep("mode")} />
                        </div>
                      ) : null}

                      {step === "quickDuration" ? (
                        <div className="space-y-4">
                          <StepTitle title="Tempo do encaixe rapido" />

                          <div className="rounded-3xl border border-[var(--brand-strong)]/25 bg-[var(--brand)]/10 p-4">
                            <p className="text-sm leading-6 text-zinc-200">
                              O agendamento sera criado usando a hora atual. Se bater em outro
                              atendimento, voce confere o aviso antes de continuar.
                            </p>
                          </div>

                          <label className="block">
                            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                              Duracao em minutos
                            </span>
                            <input
                              value={quickDurationMinutes}
                              onChange={(event) =>
                                setQuickDurationMinutes(event.target.value.replace(/\D/g, ""))
                              }
                              type="number"
                              inputMode="numeric"
                              min={5}
                              max={240}
                              step={5}
                              className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base font-black text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/40"
                            />
                          </label>

                          <div className="grid grid-cols-4 gap-2">
                            {[10, 15, 20, 30].map((duration) => (
                              <button
                                key={duration}
                                type="button"
                                onClick={() => setQuickDurationMinutes(String(duration))}
                                className={`min-h-10 rounded-xl border px-2 text-sm font-black transition ${
                                  quickDurationMinutes === String(duration)
                                    ? "border-[var(--brand)]/45 bg-[var(--brand-muted)] text-white"
                                    : "border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.06]"
                                }`}
                              >
                                {duration}m
                              </button>
                            ))}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setStep("mode")}
                              className="min-h-11 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.04]"
                            >
                              Voltar
                            </button>
                            <button
                              type="button"
                              onClick={previewQuickFitIn}
                              disabled={isQuickPreviewLoading}
                              className="min-h-11 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isQuickPreviewLoading ? "Calculando..." : "Continuar"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {step === "extras" ? (
                        <div className="space-y-4">
                          <StepTitle title="O cliente pediu algum extra?" />

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setHasExtras(false);
                                setSelectedExtraIds([]);
                              }}
                              className={`min-h-12 rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                                !hasExtras
                                  ? "border-[var(--brand)]/45 bg-[var(--brand-muted)] text-white"
                                  : "border-white/10 text-zinc-300 hover:bg-white/[0.04]"
                              }`}
                            >
                              Nao
                            </button>
                            <button
                              type="button"
                              disabled={extras.length === 0}
                              onClick={() => setHasExtras(true)}
                              className={`min-h-12 rounded-2xl border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                hasExtras
                                  ? "border-[var(--brand)]/45 bg-[var(--brand-muted)] text-white"
                                  : "border-white/10 text-zinc-300 hover:bg-white/[0.04]"
                              }`}
                            >
                              Sim
                            </button>
                          </div>

                          {hasExtras ? (
                            extras.length === 0 ? (
                              <p className="rounded-2xl border border-dashed border-white/10 p-3 text-sm text-zinc-400">
                                Nenhum extra disponivel no estoque.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {extras.map((extra) => {
                                  const selected = selectedExtraIds.includes(extra.id);

                                  return (
                                    <button
                                      key={extra.id}
                                      type="button"
                                      onClick={() => toggleExtra(extra.id)}
                                      className={`flex min-h-[54px] w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition ${
                                        selected
                                          ? "border-[var(--brand)]/45 bg-[var(--brand-muted)]"
                                          : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                                      }`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-white">
                                          {extra.name}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] text-zinc-400">
                                          {formatCurrency(extra.price)} - estoque {extra.stock}
                                        </span>
                                      </span>
                                      {selected ? (
                                        <Check className="h-4 w-4 shrink-0 text-[var(--brand-strong)]" />
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            )
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setStep(fitInMode === "quick" ? "quickDuration" : "schedule")}
                              className="min-h-11 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.04]"
                            >
                              Voltar
                            </button>
                            <button
                              type="button"
                              onClick={() => setStep("summary")}
                              className="min-h-11 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
                            >
                              Continuar
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {step === "summary" ? (
                        <div className="space-y-4">
                          <StepTitle title="Resumo" />

                          <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm">
                            <SummaryRow label="Cliente" value={normalizeCustomerName(customerName)} />
                            <SummaryRow
                              label="Telefone"
                              value={formatBrazilianPhone(customerPhone) || "Nao informado"}
                            />
                            <SummaryRow
                              label="Servicos"
                              value={
                                selectedServices.map((service) => service.name).join(" + ") ||
                                "Nao informado"
                              }
                            />
                            <SummaryRow
                              label="Tipo"
                              value={
                                fitInMode === "quick"
                                  ? "Encaixe rapido"
                                  : "Agendamento padrao"
                              }
                            />
                            <SummaryRow label="Data" value={formatDateValue(date)} />
                            <SummaryRow label="Horario" value={startTime || "Nao informado"} />
                            <SummaryRow label="Duracao" value={`${activeDuration || 0} min`} />
                            <SummaryRow
                              label="Extras"
                              value={
                                hasExtras && selectedExtras.length > 0
                                  ? selectedExtras.map((extra) => extra.name).join(" + ")
                                  : "Sem extras"
                              }
                            />
                            <SummaryRow label="Total" value={formatCurrency(selectedGrandTotal)} />
                          </div>

                          <label className="block">
                            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                              Observacao
                            </span>
                            <textarea
                              rows={2}
                              maxLength={200}
                              value={notes}
                              onChange={(event) => setNotes(event.target.value)}
                              placeholder="Opcional"
                              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/40"
                            />
                          </label>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setStep("extras")}
                              disabled={isCreating}
                              className="min-h-11 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.04]"
                            >
                              Voltar
                            </button>
                            <button
                              type="button"
                              onClick={submitSummary}
                              disabled={isCreating || selectedServiceIds.length === 0 || !startTime}
                              className="min-h-11 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isCreating ? "Criando..." : "Confirmar encaixe"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </ModalShell>,
            document.body
          )
        : null}

      {mounted && isQuickConflictOpen && quickPreview?.conflict
        ? createPortal(
            <QuickConflictPopup
              preview={quickPreview}
              onConfirm={() => {
                setIsQuickConflictOpen(false);
                setStep("extras");
              }}
              onClose={() => setIsQuickConflictOpen(false)}
            />,
            document.body
          )
        : null}

      {mounted && isSuccessOpen && successDetails
        ? createPortal(
            <ModalShell
              onClose={() => {
                setIsSuccessOpen(false);
                setSuccessDetails(null);
              }}
            >
              <div className="rounded-[28px] border border-white/10 bg-[#050b16] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                      Encaixe registrado
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Encaixe criado!
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      O horario foi reservado e a agenda do dia ja foi atualizada.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSuccessOpen(false);
                      setSuccessDetails(null);
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 flex justify-center">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                    <CheckCircle2 className="h-8 w-8" />
                  </span>
                </div>

                <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                  <SummaryRow label="Cliente" value={successDetails.customerName} />
                  <SummaryRow label="Servicos" value={successDetails.serviceName} />
                  <SummaryRow label="Data" value={formatDateValue(successDetails.date)} />
                  <SummaryRow label="Horario" value={successDetails.startTime} />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSuccessOpen(false);
                    setSuccessDetails(null);
                  }}
                  className="mt-5 min-h-11 w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Fechar
                </button>
              </div>
            </ModalShell>,
            document.body
          )
        : null}

      <OperationalFeedbackDialog
        feedback={actionFeedback}
        onClose={() => setActionFeedback(null)}
      />
    </>
  );
}

function ModalShell({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[11000]">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="pointer-events-none fixed left-1/2 top-1/2 z-[11010] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 px-0">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}

function StepTitle({ title }: { title: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
        Passo
      </p>
      <h3 className="mt-1 text-xl font-black text-white">{title}</h3>
    </div>
  );
}

function StepActions({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="min-h-11 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.04]"
    >
      Voltar
    </button>
  );
}

function TimeSection({
  title,
  slots,
  onSelect,
}: {
  title: string;
  slots: string[];
  onSelect: (slot: string) => void;
}) {
  if (slots.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {title}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onSelect(slot)}
            className="min-h-10 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-sm font-black text-white transition hover:border-[var(--brand)]/45 hover:bg-[var(--brand-muted)]"
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickConflictPopup({
  preview,
  onConfirm,
  onClose,
}: {
  preview: QuickFitInPreview;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const conflict = preview.conflict;

  if (!conflict) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[11100] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-4 py-6 backdrop-blur-md">
      <button
        type="button"
        aria-label="Fechar aviso"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative z-[11110] w-full max-w-sm rounded-[28px] border border-[var(--brand-strong)]/25 bg-[#050b16] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              Conflito de agenda
            </p>
            <h3 className="mt-1 text-2xl font-black text-white">
              Esse encaixe encosta em outro atendimento
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
          <SummaryRow label="Encaixe rapido" value={`${preview.startTime} ate ${preview.endTime}`} />
          <SummaryRow
            label="Atendimento existente"
            value={`#${String(conflict.publicId).padStart(8, "0")} - ${conflict.customerName}`}
          />
          <SummaryRow
            label="Horario existente"
            value={`${conflict.startTime} ate ${conflict.endTime}`}
          />
        </div>

        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Confirme somente se da para atender sem prejudicar o cliente ja agendado.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.04]"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
          >
            Continuar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <span className="break-words text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function FeedbackMessage({
  message,
  tone,
}: {
  message: string | null;
  tone: "success" | "error" | "info";
}) {
  if (!message) {
    return null;
  }

  const styles = {
    success: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
    error: "border-red-300/25 bg-red-500/10 text-red-100",
    info: "border-[var(--brand)]/25 bg-[var(--brand-muted)] text-[var(--brand-strong)]",
  }[tone];

  return (
    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${styles}`}>
      {message}
    </div>
  );
}
