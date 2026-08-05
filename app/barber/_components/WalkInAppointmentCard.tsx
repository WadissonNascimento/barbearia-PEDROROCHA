"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Plus,
  Scissors,
  Search,
  X,
} from "lucide-react";
import FeedbackMessage from "@/components/FeedbackMessage";
import OperationalFeedbackDialog, {
  type OperationalFeedbackState,
} from "@/components/ui/OperationalFeedbackDialog";
import {
  formatBrazilianPhone,
  isValidBrazilianPhone,
  maskBrazilianPhone,
  stripPhoneDigits,
} from "@/lib/phone";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import {
  isValidCustomerFullName,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";
import { formatCurrency } from "@/lib/utils";
import {
  createWalkInAppointmentAction,
  getQuickFitInPreviewAction,
  getWalkInAvailableSlotsAction,
} from "../actions";
import type { getBarberDashboardData } from "../data";

type BarberDashboardData = Awaited<ReturnType<typeof getBarberDashboardData>>;

type WalkInAppointmentCardProps = {
  services: BarberDashboardData["walkInServices"];
  extras: BarberDashboardData["walkInExtras"];
  clients: BarberDashboardData["clients"];
};

type WalkInSuccessDetails = {
  customerName: string;
  serviceName: string;
  date: string;
  startTime: string;
};

const WALK_IN_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

type WalkInDraft = {
  savedAt: number;
  selectedCustomerId: string;
  customerName: string;
  customerPhone: string;
  useVipPlan: boolean;
  selectedServiceIds: string[];
  hasExtras: boolean;
  selectedExtraIds: string[];
  selectedDate: string;
  startTime: string;
  notes: string;
};

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

type WalkInPeriodSlots = {
  morning: string[];
  afternoon: string[];
  night: string[];
};

type WalkInDateOption = {
  value: string;
  day: string;
  weekday: string;
  label: string;
};

const emptyWalkInPeriodSlots = (): WalkInPeriodSlots => ({
  morning: [],
  afternoon: [],
  night: [],
});

function getWalkInDraftKey() {
  if (typeof window === "undefined") {
    return "pedro-rocha:walk-in-draft";
  }

  return `pedro-rocha:walk-in-draft:${window.location.host}`;
}


function formatDateValue(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value || "Data não informada";
  }

  return `${day}/${month}/${year}`;
}

function addDaysToDateValue(value: string, daysToAdd: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + daysToAdd);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getWeekStartValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekDay = date.getDay();
  const diffToMonday = weekDay === 0 ? -6 : 1 - weekDay;
  date.setDate(date.getDate() + diffToMonday);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getWalkInDateOptions(): WalkInDateOption[] {
  const today = getCurrentScheduleDateValue();

  return Array.from({ length: 14 }, (_, index) => {
    const value = addDaysToDateValue(today, index);
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return {
      value,
      day: String(day).padStart(2, "0"),
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

function getVipPlanItems(planCode: string) {
  if (planCode === "CORTE") {
    return "Corte";
  }

  if (planCode === "CORTE_SOBRANCELHA") {
    return "Corte e sobrancelha";
  }

  if (planCode === "CORTE_BARBA_SOBRANCELHA") {
    return "Corte, sobrancelha e barba";
  }

  return "Combo mensal";
}

function getVipPlanDuration(planCode: string) {
  if (planCode === "CORTE") {
    return 45;
  }

  if (planCode === "CORTE_SOBRANCELHA") {
    return 60;
  }

  if (planCode === "CORTE_BARBA_SOBRANCELHA") {
    return 60;
  }

  return 45;
}

export default function WalkInAppointmentCard({
  services,
  extras,
  clients,
}: WalkInAppointmentCardProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [isQuickConflictOpen, setIsQuickConflictOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [feedback, setFeedback] = useState<{
    message: string | null;
    tone: "success" | "error" | "info";
  }>({ message: null, tone: "success" });
  const [successDetails, setSuccessDetails] = useState<WalkInSuccessDetails | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const [isQuickPreviewLoading, setIsQuickPreviewLoading] = useState(false);
  const [actionFeedback, setActionFeedback] =
    useState<OperationalFeedbackState>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [useVipPlan, setUseVipPlan] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [fitInMode, setFitInMode] = useState<FitInMode>("standard");
  const [quickDurationMinutes, setQuickDurationMinutes] = useState("20");
  const [quickPreview, setQuickPreview] = useState<QuickFitInPreview | null>(null);
  const [hasExtras, setHasExtras] = useState(false);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [startTime, setStartTime] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const selectedServices = useMemo(
    () => services.filter((service) => selectedServiceIds.includes(service.id)),
    [selectedServiceIds, services]
  );
  const selectedDuration = selectedServices.reduce(
    (sum, service) => sum + service.duration,
    0
  );
  const selectedTotal = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const selectedExtras = useMemo(
    () => extras.filter((extra) => selectedExtraIds.includes(extra.id)),
    [selectedExtraIds, extras]
  );
  const selectedExtrasTotal = selectedExtras.reduce((sum, extra) => sum + extra.price, 0);
  const selectedCustomerById =
    clients.find((client) => client.id === selectedCustomerId) || null;
  const customerPhoneDigits = stripPhoneDigits(customerPhone);
  const customerMatchedByPhone =
    customerPhoneDigits.length === 11
      ? clients.find((client) => stripPhoneDigits(client.phone) === customerPhoneDigits) || null
      : null;
  const selectedCustomer = customerPhone.trim()
    ? customerMatchedByPhone
    : selectedCustomerById;
  const vipSubscription = customerMatchedByPhone?.vipSubscription || null;
  const vipPlanDuration =
    useVipPlan && vipSubscription ? getVipPlanDuration(vipSubscription.plan.code) : 0;
  const selectedItemsCount = selectedServiceIds.length + (useVipPlan ? 1 : 0);
  const hasBookableItem = selectedItemsCount > 0;
  const selectedGrandTotal =
    selectedTotal + selectedExtrasTotal;
  const selectedVipWeekAlreadyUsed = Boolean(
    selectedDate &&
      vipSubscription?.weeklyUsedWeekStarts.includes(getWeekStartValue(selectedDate))
  );
  const vipPaymentCovered = Boolean(vipSubscription?.paymentCovered);
  const canUseVipPlan =
    Boolean(vipSubscription && vipSubscription.tokensRemaining > 0) &&
    vipPaymentCovered;
  const vipUnavailableMessage = vipSubscription && vipSubscription.tokensRemaining < 1
    ? "Este cliente não possui atendimentos disponíveis neste ciclo."
    : vipSubscription && !vipPaymentCovered
      ? "O pagamento deste ciclo venceu e ainda está pendente."
      : null;
  const vipWeekAlreadyUsedMessage =
    "Este cliente já possui um atendimento do plano mensal nesta semana. Escolha outra semana para usar o plano ou marque como atendimento avulso.";
  const filteredClients = useMemo(() => {
    const search = clientSearch.trim().toLowerCase();

    if (!search) {
      return clients;
    }

    return clients.filter((client) =>
      [client.name, client.phone || "", client.email || ""].some((value) =>
        value.toLowerCase().includes(search)
      )
    );
  }, [clientSearch, clients]);
  const [step, setStep] = useState<WalkInStep>("customer");
  const dateOptions = useMemo(() => getWalkInDateOptions(), []);
  const hasCustomerMinimum =
    (isValidCustomerFullName(customerName) || Boolean(customerMatchedByPhone)) &&
    (!customerPhone.trim() || isValidBrazilianPhone(customerPhone));
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availablePeriodSlots, setAvailablePeriodSlots] = useState<WalkInPeriodSlots>(
    () => emptyWalkInPeriodSlots()
  );
  const [slotsFeedback, setSlotsFeedback] = useState<{
    message: string;
    tone: "info" | "error";
  }>({
    message: "Selecione os serviços para ver os horários disponíveis.",
    tone: "info",
  });
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const isDisabled = services.length === 0;
  const activeDuration =
    fitInMode === "quick"
      ? Number(quickDurationMinutes) || 0
      : selectedDuration + vipPlanDuration;
  const isCreating = isPending || isSubmitLocked;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSelectedServiceIds((current) =>
      current.filter((serviceId) => services.some((service) => service.id === serviceId))
    );
  }, [services]);

  useEffect(() => {
    setSelectedExtraIds((current) =>
      current.filter((extraId) => extras.some((extra) => extra.id === extraId))
    );
  }, [extras]);

  useEffect(() => {
    if (
      !mounted ||
      (!isOpen && !isSuccessOpen && !isClientPickerOpen && !isQuickConflictOpen)
    ) {
      return;
    }

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen, isSuccessOpen, isClientPickerOpen, isQuickConflictOpen, mounted]);

  useEffect(() => {
    if (!mounted || !isOpen) {
      return;
    }

    const draft: WalkInDraft = {
      savedAt: Date.now(),
      selectedCustomerId,
      customerName,
      customerPhone,
      useVipPlan,
      selectedServiceIds,
      hasExtras,
      selectedExtraIds,
      selectedDate,
      startTime,
      notes,
    };

    window.localStorage.setItem(getWalkInDraftKey(), JSON.stringify(draft));
  }, [
    customerName,
    customerPhone,
    hasExtras,
    isOpen,
    mounted,
    notes,
    selectedCustomerId,
    selectedDate,
    selectedExtraIds,
    selectedServiceIds,
    startTime,
    useVipPlan,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!selectedDate || !hasBookableItem) {
      setAvailableSlots([]);
      setAvailablePeriodSlots(emptyWalkInPeriodSlots());
      setStartTime("");
      setSlotsFeedback({
        message: "Selecione os serviços para ver os horários disponíveis.",
        tone: "info",
      });
      setIsLoadingSlots(false);
      return;
    }

    let cancelled = false;

    setIsLoadingSlots(true);
    setSlotsFeedback({
      message: "Carregando horários disponíveis...",
      tone: "info",
    });

    getWalkInAvailableSlotsAction({
      date: selectedDate,
      serviceIds: selectedServiceIds,
      additionalDurationMinutes: vipPlanDuration,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setAvailableSlots([]);
          setAvailablePeriodSlots(emptyWalkInPeriodSlots());
          setStartTime("");
          setSlotsFeedback({
            message: result.message,
            tone: "error",
          });
          return;
        }

        const periodSlots = result.data?.periodSlots || emptyWalkInPeriodSlots();
        const slots = result.data?.slots || [
          ...periodSlots.morning,
          ...periodSlots.afternoon,
          ...periodSlots.night,
        ];

        setAvailableSlots(slots);
        setAvailablePeriodSlots(periodSlots);
        setStartTime((current) => (slots.includes(current) ? current : ""));
        setSlotsFeedback({
          message:
            slots.length > 0
              ? "Toque em um horário para reservar o encaixe."
              : "Nenhum horário disponível para essa data e duração.",
          tone: slots.length > 0 ? "info" : "error",
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAvailableSlots([]);
        setAvailablePeriodSlots(emptyWalkInPeriodSlots());
        setStartTime("");
        setSlotsFeedback({
          message: "Não foi possível carregar os horários. Tente novamente.",
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
  }, [hasBookableItem, isOpen, selectedDate, selectedServiceIds, vipPlanDuration]);

  function closeModal() {
    if (isCreating) {
      return;
    }

    setIsOpen(false);
    setIsClientPickerOpen(false);
    setIsQuickConflictOpen(false);
    setQuickPreview(null);
    setFeedback({ message: null, tone: "success" });
    setActionFeedback(null);
  }

  function closeSuccessModal() {
    setIsSuccessOpen(false);
    setSuccessDetails(null);
  }

  function openWalkInModal() {
    let parsedDraft: WalkInDraft | null = null;

    try {
      const storedDraft = window.localStorage.getItem(getWalkInDraftKey());
      parsedDraft = storedDraft ? (JSON.parse(storedDraft) as WalkInDraft) : null;
    } catch {
      window.localStorage.removeItem(getWalkInDraftKey());
    }

    const validDraft =
      parsedDraft &&
      Date.now() - parsedDraft.savedAt <= WALK_IN_DRAFT_MAX_AGE_MS;
    const draft = validDraft ? parsedDraft : null;

    setSelectedCustomerId(draft ? draft.selectedCustomerId : "");
    setCustomerName(draft ? draft.customerName : "");
    setCustomerPhone(draft ? draft.customerPhone : "");
    setUseVipPlan(draft ? Boolean(draft.useVipPlan) : false);
    setClientSearch("");
    setIsClientPickerOpen(false);
    setSelectedServiceIds(draft ? draft.selectedServiceIds : []);
    setFitInMode("standard");
    setQuickDurationMinutes("20");
    setQuickPreview(null);
    setIsQuickConflictOpen(false);
    setHasExtras(draft ? draft.hasExtras : false);
    setSelectedExtraIds(draft ? draft.selectedExtraIds : []);
    setSelectedDate(draft ? draft.selectedDate : "");
    setStartTime(draft ? draft.startTime : "");
    setNotes(draft ? draft.notes : "");
    setFeedback({ message: null, tone: "success" });
    setActionFeedback(null);
    setStep("customer");
    setIsOpen(true);
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) => {
      const next = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];

      setStartTime("");
      return next;
    });
  }

  function useSelectedCustomerVipPlan() {
    if (!vipSubscription) {
      showWalkInError(
        "Cliente sem assinatura",
        "Informe o telefone de um cliente assinante para usar o plano mensal."
      );
      return;
    }

    if (!canUseVipPlan) {
      return;
    }

    setUseVipPlan(true);
    setStartTime("");
    setFeedback({ message: null, tone: "success" });
  }

  function deselectCustomerVipPlan() {
    setUseVipPlan(false);
    setStartTime("");
    setAvailableSlots([]);
    setFeedback({ message: null, tone: "success" });
  }

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((current) =>
      current.includes(extraId)
        ? current.filter((id) => id !== extraId)
        : [...current, extraId]
    );
  }

  function selectExistingCustomer(customerId: string) {
    setSelectedCustomerId(customerId);
    setUseVipPlan(false);

    if (!customerId) {
      return;
    }

    const customer = clients.find((client) => client.id === customerId);
    if (!customer) {
      return;
    }

    setCustomerName(customer.name);
    setCustomerPhone(formatBrazilianPhone(customer.phone));
    setClientSearch("");
    setIsClientPickerOpen(false);
  }

  function showWalkInError(title: string, message: string) {
    setFeedback({ message, tone: "error" });
    setActionFeedback({ title, message, tone: "error" });
  }

  function goToServicesStep() {
    const normalizedName = normalizeCustomerName(customerName);
    const hasPhone = Boolean(customerPhone.trim());

    setCustomerName(normalizedName);

    if (!isValidCustomerFullName(normalizedName) && !customerMatchedByPhone) {
      showWalkInError(
        "Confira o cliente",
        "Informe nome e sobrenome do cliente para criar o encaixe."
      );
      return;
    }

    if (hasPhone && !isValidBrazilianPhone(customerPhone)) {
      showWalkInError(
        "Confira o telefone",
        "O telefone é opcional, mas precisa ser válido quando for informado."
      );
      return;
    }

    setFeedback({ message: null, tone: "success" });
    setStep("services");
  }

  function goToScheduleStep() {
    if (!hasBookableItem) {
      showWalkInError(
        "Escolha o serviço",
        "Selecione pelo menos um serviço ou use o plano mensal para carregar os horários disponíveis."
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

    if (useVipPlan && selectedVipWeekAlreadyUsed) {
      setActionFeedback({
        title: "Plano mensal já usado nesta semana",
        message: vipWeekAlreadyUsedMessage,
        tone: "error",
      });
      return;
    }

    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      showWalkInError(
        "Confira o tempo",
        "Informe uma duração entre 5 e 240 minutos para o encaixe rápido."
      );
      return;
    }

    setIsQuickPreviewLoading(true);
    setFeedback({ message: null, tone: "success" });

    try {
      const result = await getQuickFitInPreviewAction({ durationMinutes: duration });

      if (!result.ok || !result.data) {
        showWalkInError(
          "Não foi possível calcular",
          result.message || "Tente novamente em instantes."
        );
        return;
      }

      if (
        useVipPlan &&
        vipSubscription?.weeklyUsedWeekStarts.includes(getWeekStartValue(result.data.date))
      ) {
        setActionFeedback({
          title: "Plano mensal já usado nesta semana",
          message: vipWeekAlreadyUsedMessage,
          tone: "error",
        });
        return;
      }

      setQuickPreview(result.data);
      setSelectedDate(result.data.date);
      setStartTime(result.data.startTime);

      if (result.data.conflict) {
        setIsQuickConflictOpen(true);
        return;
      }

      setStep("extras");
    } catch {
      showWalkInError(
        "Não foi possível calcular",
        "Tente novamente em instantes."
      );
    } finally {
      setIsQuickPreviewLoading(false);
    }
  }

  function selectWalkInSlot(slot: string) {
    if (useVipPlan && selectedVipWeekAlreadyUsed) {
      setActionFeedback({
        title: "Plano mensal já usado nesta semana",
        message: vipWeekAlreadyUsedMessage,
        tone: "error",
      });
      return;
    }

    setStartTime(slot);
    setFeedback({ message: null, tone: "success" });
    setStep("extras");
  }

  function createWalkInFromSummary(
    formData: FormData,
    summary: {
      customerName: string;
      serviceName: string;
      date: string;
      startTime: string;
    }
  ) {
    if (isCreating) {
      return;
    }

    setIsSubmitLocked(true);

    startTransition(async () => {
      try {
        const result = await createWalkInAppointmentAction(formData);

        setFeedback({
          message: result.ok ? null : result.message,
          tone: result.tone,
        });

        if (result.ok) {
          window.localStorage.removeItem(getWalkInDraftKey());
          setActionFeedback(null);
          setSuccessDetails({
            customerName: summary.customerName || "Cliente",
            serviceName: summary.serviceName,
            date: summary.date,
            startTime: summary.startTime || startTime,
          });
          setSelectedCustomerId("");
          setCustomerName("");
          setCustomerPhone("");
          setUseVipPlan(false);
          setSelectedServiceIds([]);
          setFitInMode("standard");
          setQuickDurationMinutes("20");
          setQuickPreview(null);
          setHasExtras(false);
          setSelectedExtraIds([]);
          setNotes("");
          setIsOpen(false);
          setIsSuccessOpen(true);
          setStartTime("");
          setStep("customer");
          router.refresh();
        } else {
          setActionFeedback({
            title: "Não foi possível criar o encaixe",
            message: result.message,
            tone: "error",
          });
        }
      } catch {
        setFeedback({
          message: "Não foi possível criar o encaixe. Tente novamente.",
          tone: "error",
        });
        setActionFeedback({
          title: "Erro ao criar encaixe",
          message:
            "Não foi possível salvar o encaixe agora. Os dados ficaram preenchidos para você tentar novamente.",
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
        disabled={isDisabled}
        onClick={openWalkInModal}
        className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-4 w-4 text-[var(--brand-strong)]" />
        <span className="min-w-0 truncate">Criar encaixe</span>
      </button>

      {mounted && isOpen
        ? createPortal(
            <ModalShell onClose={closeModal}>
              <div className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[30px] border border-white/10 bg-[#050b16] shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--brand-strong)]">
                        Encaixe manual
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                        Criar encaixe manual
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
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

                  {services.length === 0 ? (
                    <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
                      Cadastre um serviço ativo antes de criar encaixes.
                    </p>
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();

                        if (step !== "summary") {
                          return;
                        }

                        const form = event.currentTarget;
                        const formData = new FormData(form);
                        const submittedCustomerName = normalizeCustomerName(
                          String(formData.get("customerName") || "")
                        );
                        const submittedCustomerPhone = String(
                          formData.get("customerPhone") || ""
                        );
                        const submittedDate = String(formData.get("date") || "").trim();
                        const selectedStartTime = String(formData.get("startTime") || "").trim();
                        const serviceName =
                          [
                            useVipPlan && vipSubscription
                              ? getVipPlanItems(vipSubscription.plan.code)
                              : "",
                            selectedServices.map((service) => service.name).join(" + "),
                          ]
                            .filter(Boolean)
                            .join(" + ") || "Serviço";

                        if (
                          !isValidCustomerFullName(submittedCustomerName) &&
                          !customerMatchedByPhone
                        ) {
                          showWalkInError(
                            "Confira o cliente",
                            "Informe nome e sobrenome do cliente antes de criar o encaixe."
                          );
                          return;
                        }

                        if (
                          submittedCustomerPhone.trim() &&
                          !isValidBrazilianPhone(submittedCustomerPhone)
                        ) {
                          showWalkInError(
                            "Confira o telefone",
                            "O telefone é opcional, mas precisa ser válido quando for informado."
                          );
                          return;
                        }

                        if (
                          fitInMode === "standard" &&
                          !availableSlots.includes(selectedStartTime)
                        ) {
                          showWalkInError(
                            "Escolha o horário",
                            "Selecione um horário disponível na lista antes de criar o encaixe."
                          );
                          return;
                        }

                        createWalkInFromSummary(formData, {
                          customerName: submittedCustomerName || "Cliente",
                          serviceName,
                          date: submittedDate || selectedDate,
                          startTime: selectedStartTime || startTime,
                        });
                      }}
                    >
                      <input
                        type="hidden"
                        name="customerId"
                        value={selectedCustomer?.id || ""}
                      />
                      <input
                        type="hidden"
                        name="customerName"
                        value={normalizeCustomerName(customerName)}
                      />
                      <input type="hidden" name="customerPhone" value={customerPhone} />
                      <input type="hidden" name="date" value={selectedDate} />
                      <input type="hidden" name="startTime" value={startTime} />
                      <input type="hidden" name="notes" value={notes} />
                      <input type="hidden" name="fitInMode" value={fitInMode} />
                      <input type="hidden" name="useVipPlan" value={String(useVipPlan)} />
                      <input
                        type="hidden"
                        name="manualDurationMinutes"
                        value={quickDurationMinutes}
                      />
                      {selectedServiceIds.map((serviceId) => (
                        <input key={serviceId} type="hidden" name="serviceIds" value={serviceId} />
                      ))}
                      {hasExtras
                        ? selectedExtraIds.map((extraId) => (
                            <input
                              key={extraId}
                              type="hidden"
                              name="extraProductIds"
                              value={extraId}
                            />
                          ))
                        : null}

                      {step === "customer" ? (
                        <div className="space-y-4">
                          <StepTitle title="Cliente do encaixe" />

                          <button
                            type="button"
                            onClick={() => setIsClientPickerOpen(true)}
                            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-muted)] px-4 py-3 text-left text-sm text-white transition hover:border-[var(--brand)]/50"
                          >
                            <span className="min-w-0">
                              <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]">
                                Cliente cadastrado
                              </span>
                              <span className="mt-1 block truncate font-black">
                                {selectedCustomer?.name || "Selecionar cliente"}
                              </span>
                              <span className="mt-1 block truncate text-xs text-zinc-400">
                                {selectedCustomer
                                  ? formatBrazilianPhone(selectedCustomer.phone) ||
                                    selectedCustomer.email ||
                                    "Sem contato"
                                  : "Opcional: buscar na base da barbearia"}
                              </span>
                            </span>
                            <Search className="h-4 w-4 shrink-0 text-[var(--brand-strong)]" />
                          </button>

                          <div className="grid gap-3">
                            <label className="block">
                              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                Nome completo
                              </span>
                              <input
                                value={customerName}
                                onChange={(event) => {
                                  setSelectedCustomerId("");
                                  setUseVipPlan(false);
                                  setCustomerName(event.target.value);
                                }}
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
                                onChange={(event) => {
                                  setSelectedCustomerId("");
                                  setUseVipPlan(false);
                                  setCustomerPhone(maskBrazilianPhone(event.target.value));
                                }}
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                maxLength={15}
                                placeholder="(11) 96590-0713"
                                className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-[var(--brand)]/40"
                              />
                              {customerMatchedByPhone ? (
                                <span className="mt-2 block text-xs font-bold text-emerald-300">
                                  {customerMatchedByPhone.vipSubscription
                                    ? `Assinante ${customerMatchedByPhone.vipSubscription.plan.name} identificado pelo telefone.`
                                    : "Cliente cadastrado identificado pelo telefone."}
                                </span>
                              ) : null}
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
                          <StepTitle title="Serviços" />

                          {vipSubscription ? (
                            <div
                              className={`relative overflow-hidden rounded-2xl border p-3 transition ${
                                useVipPlan
                                  ? "border-emerald-300/45 bg-emerald-300/[0.09] shadow-[0_16px_36px_rgba(16,185,129,0.12)]"
                                  : "border-amber-300/35 bg-amber-300/[0.08]"
                              }`}
                            >
                              <div>
                                <p
                                  className={`inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] ${
                                    useVipPlan ? "text-emerald-200" : "text-amber-200"
                                  }`}
                                >
                                  {useVipPlan ? (
                                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  ) : null}
                                  Cliente assinante: {vipSubscription.plan.name}
                                </p>
                                <p className="mt-1 text-sm font-black text-white">
                                  {useVipPlan ? "Plano mensal selecionado" : "Usar plano mensal"}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-zinc-300">
                                  {getVipPlanItems(vipSubscription.plan.code)} incluso no plano. Serviços
                                  adicionais serão cobrados à parte.
                                </p>
                                {vipUnavailableMessage ? (
                                  <p className="mt-2 rounded-xl border border-amber-300/20 bg-black/25 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
                                    {vipUnavailableMessage}
                                  </p>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={!canUseVipPlan && !useVipPlan}
                                  onClick={
                                    useVipPlan
                                      ? deselectCustomerVipPlan
                                      : useSelectedCustomerVipPlan
                                  }
                                  className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
                                    useVipPlan
                                      ? "border border-emerald-300/35 bg-emerald-300/15 text-emerald-100"
                                      : "bg-amber-100 text-zinc-950 hover:bg-white"
                                  } disabled:cursor-not-allowed`}
                                >
                                  {useVipPlan ? (
                                    <>
                                      <X className="h-4 w-4" aria-hidden="true" />
                                      Desmarcar plano
                                    </>
                                  ) : (
                                    "Usar plano mensal"
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            {services.map((service) => {
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

                          <StepActions
                            onBack={() => setStep("customer")}
                            backLabel="Voltar"
                          />

                          {hasBookableItem ? (
                            <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-white/10 bg-[#050505]/95 p-4 backdrop-blur-xl">
                              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand)]/45 bg-[linear-gradient(135deg,rgba(184,148,95,0.95),rgba(124,94,50,0.95))] px-4 py-3 text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
                                    {selectedItemsCount} item(ns)
                                  </p>
                                  <p className="text-lg font-black">
                                    {formatCurrency(selectedGrandTotal)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={goToScheduleStep}
                                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-white bg-white px-5 py-2 text-sm font-black text-[#14100a] shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition hover:bg-[#fff7e8] active:scale-[0.98]"
                                >
                                  Continuar
                                  <ArrowRight className="h-4 w-4" />
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
                                  Agendamento padrão
                                </span>
                                <span className="mt-1 block text-sm leading-5 text-zinc-400">
                                  Escolhe data e horário livre na agenda.
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
                                  Encaixe rápido
                                </span>
                                <span className="mt-1 block text-sm leading-5 text-zinc-400">
                                  Usa o horário atual e permite confirmar mesmo encostando em outro atendimento.
                                </span>
                              </span>
                            </button>
                          </div>

                          <StepActions onBack={() => setStep("services")} backLabel="Voltar" />
                        </div>
                      ) : null}

                      {step === "schedule" ? (
                        <div className="space-y-4">
                          <StepTitle title="Data e horário" />

                          <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
                            {dateOptions.map((option) => {
                              const selected = selectedDate === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDate(option.value);
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
                                  Horários disponíveis
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
                                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                              ) : null}
                            </div>

                            {availableSlots.length > 0 ? (
                              <div className="mt-4 grid min-w-0 gap-4">
                                <WalkInTimeSection
                                  title="Manha"
                                  slots={availablePeriodSlots.morning}
                                  onSelect={selectWalkInSlot}
                                />
                                <WalkInTimeSection
                                  title="Tarde"
                                  slots={availablePeriodSlots.afternoon}
                                  onSelect={selectWalkInSlot}
                                />
                                <WalkInTimeSection
                                  title="Noite"
                                  slots={availablePeriodSlots.night}
                                  onSelect={selectWalkInSlot}
                                />
                              </div>
                            ) : null}
                          </div>

                          <StepActions
                            onBack={() => setStep("mode")}
                            backLabel="Voltar"
                          />
                        </div>
                      ) : null}

                      {step === "quickDuration" ? (
                        <div className="space-y-4">
                          <StepTitle title="Tempo do encaixe rápido" />

                          <div className="rounded-3xl border border-[var(--brand-strong)]/25 bg-[var(--brand)]/10 p-4">
                            <p className="text-sm leading-6 text-zinc-200">
                              O agendamento será criado usando a hora atual. Se bater em outro
                              atendimento, você confere o aviso antes de continuar.
                            </p>
                          </div>

                          <label className="block">
                            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                              Duração em minutos
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
                              Não
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
                                Nenhum extra disponível no estoque.
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
                              value={formatBrazilianPhone(customerPhone) || "Não informado"}
                            />
                            <SummaryRow
                              label="Serviços"
                              value={
                                [
                                  useVipPlan && vipSubscription
                                    ? getVipPlanItems(vipSubscription.plan.code)
                                    : "",
                                  selectedServices.map((service) => service.name).join(" + "),
                                ]
                                  .filter(Boolean)
                                  .join(" + ") || "Não informado"
                              }
                            />
                            {useVipPlan && vipSubscription ? (
                              <SummaryRow
                                label="Plano mensal"
                                value={`${vipSubscription.plan.name} - combo incluso`}
                              />
                            ) : null}
                            <SummaryRow
                              label="Tipo"
                              value={
                                fitInMode === "quick"
                                  ? "Encaixe rápido"
                                  : "Agendamento padrão"
                              }
                            />
                            <SummaryRow label="Data" value={formatDateValue(selectedDate)} />
                            <SummaryRow label="Horário" value={startTime || "Não informado"} />
                            <SummaryRow label="Duração" value={`${activeDuration || 0} min`} />
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
                              Observação
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
                              type="submit"
                              disabled={isCreating || !hasBookableItem || !startTime}
                              className="min-h-11 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isCreating ? "Criando..." : "Confirmar encaixe"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </form>
                  )}
                </div>
              </div>
            </ModalShell>,
            document.body
          )
        : null}

      {mounted && isClientPickerOpen
        ? createPortal(
            <ClientPickerPopup
              clients={filteredClients}
              search={clientSearch}
              selectedCustomerId={selectedCustomerId}
              onSearchChange={setClientSearch}
              onSelect={selectExistingCustomer}
              onClear={() => {
                setSelectedCustomerId("");
                setCustomerName("");
                setCustomerPhone("");
                setUseVipPlan(false);
                setClientSearch("");
                setIsClientPickerOpen(false);
              }}
              onClose={() => setIsClientPickerOpen(false)}
            />,
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
            <ModalShell onClose={closeSuccessModal}>
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
                      O horário foi reservado e a agenda do dia já foi atualizada.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeSuccessModal}
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
                  <SummaryRow label="Serviços" value={successDetails.serviceName} />
                  <SummaryRow label="Data" value={formatDateValue(successDetails.date)} />
                  <SummaryRow label="Horário" value={successDetails.startTime} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={closeSuccessModal}
                    className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.04]"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeSuccessModal();
                      router.push("/barber");
                    }}
                    className="min-h-11 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Voltar para o painel
                  </button>
                </div>
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
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="pointer-events-none fixed left-1/2 top-1/2 z-[210] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 px-0">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}

function ClientPickerPopup({
  clients,
  search,
  selectedCustomerId,
  onSearchChange,
  onSelect,
  onClear,
  onClose,
}: {
  clients: WalkInAppointmentCardProps["clients"];
  search: string;
  selectedCustomerId: string;
  onSearchChange: (value: string) => void;
  onSelect: (customerId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[260] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-4 py-6 backdrop-blur-md"
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => {
        if (!(event.target as HTMLElement).closest("[data-client-picker-scroll]")) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="button"
        aria-label="Fechar seletor de cliente"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative z-[270] flex max-h-[calc(100svh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#050b16] shadow-[0_28px_90px_rgba(0,0,0,0.7)]">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
                Clientes
              </p>
              <h3 className="mt-1 text-xl font-black text-white">
                Selecionar cliente
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                Busque na base do barbeiro.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              name="clientSearch"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Nome, numero ou e-mail"
              autoComplete="off"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              autoFocus
            />
          </div>
        </div>

        <div
          data-client-picker-scroll
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-3"
        >
          <button
            type="button"
            onClick={onClear}
            className="mb-2 flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left text-sm font-bold text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Preencher manualmente
            {!selectedCustomerId ? <Check className="h-4 w-4 text-[var(--brand-strong)]" /> : null}
          </button>

          {clients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => {
                const selected = client.id === selectedCustomerId;

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => onSelect(client.id)}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-[var(--brand)]/45 bg-[var(--brand-muted)]"
                        : "border-white/10 bg-black/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">
                        {client.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-400">
                        {formatBrazilianPhone(client.phone) || client.email || "Sem contato"}
                      </span>
                    </span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-[var(--brand-strong)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
    <div className="fixed inset-0 z-[290] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-4 py-6 backdrop-blur-md">
      <button
        type="button"
        aria-label="Fechar aviso"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative z-[300] w-full max-w-sm rounded-[28px] border border-[var(--brand-strong)]/25 bg-[#050b16] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.7)]">
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
          <SummaryRow label="Encaixe rápido" value={`${preview.startTime} ate ${preview.endTime}`} />
          <SummaryRow
            label="Atendimento existente"
            value={`#${String(conflict.publicId).padStart(8, "0")} - ${conflict.customerName}`}
          />
          <SummaryRow
            label="Horário existente"
            value={`${conflict.startTime} ate ${conflict.endTime}`}
          />
        </div>

        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Confirme somente se da para atender sem prejudicar o cliente já agendado.
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

function StepTitle({ title }: { title: string }) {
  return (
    <h3 className="text-xl font-black tracking-tight text-white">{title}</h3>
  );
}

function WalkInTimeSection({
  title,
  slots,
  onSelect,
}: {
  title: string;
  slots: string[];
  onSelect: (slot: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-base font-semibold text-white">{title}</h4>
        <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          {slots.length} disponíveis
        </span>
      </div>

      {slots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-zinc-500">
          Sem horários livres nesse período.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onSelect(slot)}
              className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand-muted)]"
            >
              {slot}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StepActions({
  onBack,
  backLabel,
}: {
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="min-h-11 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.04]"
    >
      {backLabel}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}
