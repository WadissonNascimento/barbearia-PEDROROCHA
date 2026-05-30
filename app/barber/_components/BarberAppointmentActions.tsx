"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronDown, Pencil, ShoppingBag, UserX, XCircle } from "lucide-react";
import OperationalFeedbackDialog, {
  type OperationalFeedbackState,
} from "@/components/ui/OperationalFeedbackDialog";
import {
  editCompletedBarberFinanceAppointmentAction,
  editOpenBarberAppointmentAction,
  updateAppointmentStatusAction,
} from "../actions";
import { formatCurrency } from "@/lib/utils";
import {
  APPOINTMENT_PAYMENT_METHODS,
  paymentMethodLabel,
  type AppointmentPaymentMethod,
} from "@/lib/paymentMethods";
import type { BarberAppointmentItemDeliveryDecision } from "./BarberAppointmentCard";

type Feedback = {
  message: string | null;
  tone: "success" | "error" | "info";
};

type BarberAppointmentActionsProps = {
  appointmentId: string;
  status: string;
  onFeedback: (feedback: Feedback) => void;
  onStatusUpdated?: (appointmentId: string, status: string) => void;
  hasPickupItems?: boolean;
  allPickupItemsReviewed?: boolean;
  itemDeliveryDecisions?: BarberAppointmentItemDeliveryDecision[];
  services?: Array<{
    id: string;
    name: string;
    price: number;
    duration: number;
  }>;
  extras?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
  }>;
  currentServiceIds?: string[];
  currentExtraProductIds?: string[];
  notes?: string | null;
};

export default function BarberAppointmentActions({
  appointmentId,
  status,
  onFeedback,
  onStatusUpdated,
  hasPickupItems = false,
  allPickupItemsReviewed = true,
  itemDeliveryDecisions = [],
  services = [],
  extras = [],
  currentServiceIds = [],
  currentExtraProductIds = [],
  notes = null,
}: BarberAppointmentActionsProps) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPaymentPromptOpen, setIsPaymentPromptOpen] = useState(false);
  const [actionFeedback, setActionFeedback] =
    useState<OperationalFeedbackState>(null);
  const [, startTransition] = useTransition();
  const isPending = Boolean(pendingStatus) || isSubmittingStatus;
  const isCompletedEdit = ["COMPLETED", "DONE"].includes(status);
  const canEditItems =
    ["PENDING", "CONFIRMED", "COMPLETED", "DONE"].includes(status) &&
    services.length > 0;
  const canComplete = ["PENDING", "CONFIRMED"].includes(status);

  function validateCompletion() {
    if (
      hasPickupItems &&
      !allPickupItemsReviewed
    ) {
      onFeedback({
        message: "Marque todas as retiradas antes de concluir.",
        tone: "error",
      });
      setActionFeedback({
        title: "Revise as retiradas",
        message: "Marque todas as retiradas antes de concluir o atendimento.",
        tone: "error",
      });
      return false;
    }

    return true;
  }

  function requestCompletion() {
    if (!validateCompletion()) {
      return;
    }

    setIsPaymentPromptOpen(true);
  }

  function submitStatus(
    nextStatus: string,
    paymentMethod?: AppointmentPaymentMethod
  ) {
    if (isPending) {
      return;
    }

    if (nextStatus === "COMPLETED" && !validateCompletion()) {
      return;
    }

    if (nextStatus === "COMPLETED" && !paymentMethod) {
      setIsPaymentPromptOpen(true);
      return;
    }

    const cancellationReason =
      nextStatus === "CANCELLED"
        ? window.prompt("Motivo do cancelamento:")?.trim()
        : "";

    if (nextStatus === "CANCELLED" && !cancellationReason) {
      return;
    }

    setPendingStatus(nextStatus);
    setIsSubmittingStatus(true);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("appointmentId", appointmentId);
        formData.set("status", nextStatus);

        if (nextStatus === "COMPLETED") {
          formData.set("paymentMethod", paymentMethod || "");

          for (const decision of itemDeliveryDecisions) {
            formData.append(
              "itemDeliveryDecision",
              `${decision.appointmentItemId}:${decision.isDelivered ? "delivered" : "not_delivered"}`
            );
          }
        }

        if (cancellationReason) {
          formData.set("cancellationReason", cancellationReason);
        }

        const result = await updateAppointmentStatusAction(formData);
        onFeedback({ message: result.message, tone: result.tone });

        if (result.ok) {
          setIsPaymentPromptOpen(false);
          setActionFeedback(null);
          onStatusUpdated?.(appointmentId, nextStatus);
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
          onStatusUpdated?.(appointmentId, status);
        }
      } catch {
        onFeedback({
          message: "Nao foi possivel atualizar o atendimento. Tente novamente.",
          tone: "error",
        });
        setActionFeedback({
          title: "Erro ao salvar",
          message:
            "Nao foi possivel atualizar o atendimento agora. Confira sua conexao e tente novamente.",
          tone: "error",
        });
        onStatusUpdated?.(appointmentId, status);
      } finally {
        setPendingStatus(null);
        setIsSubmittingStatus(false);
      }
    });
  }

  return (
    <>
      {canEditItems ? (
        <ActionButton
          disabled={isPending}
          pending={false}
          variant="secondary"
          icon={<Pencil />}
          onClick={() => setIsEditing(true)}
        >
          Editar
        </ActionButton>
      ) : null}
      {canComplete ? (
        <ActionButton
          disabled={isPending}
          pending={pendingStatus === "COMPLETED"}
          variant="primary"
          icon={<CheckCircle2 />}
          onClick={requestCompletion}
        >
          Concluir
        </ActionButton>
      ) : null}
      {canComplete ? (
        <ActionButton
          disabled={isPending}
          pending={pendingStatus === "NO_SHOW"}
          variant="warning"
          icon={<UserX />}
          onClick={() => submitStatus("NO_SHOW")}
        >
          Faltou
        </ActionButton>
      ) : null}
      {canComplete ? (
        <ActionButton
          disabled={isPending}
          pending={pendingStatus === "CANCELLED"}
          variant="danger"
          icon={<XCircle />}
          onClick={() => submitStatus("CANCELLED")}
        >
          Cancelar
        </ActionButton>
      ) : null}
      {isPaymentPromptOpen ? (
        <PaymentMethodPrompt
          isPending={isPending}
          onClose={() => setIsPaymentPromptOpen(false)}
          onSelect={(paymentMethod) => submitStatus("COMPLETED", paymentMethod)}
        />
      ) : null}
      {isEditing ? (
        <BarberEditAppointmentModal
          appointmentId={appointmentId}
          isCompletedEdit={isCompletedEdit}
          services={services}
          extras={extras}
          currentServiceIds={currentServiceIds}
          currentExtraProductIds={currentExtraProductIds}
          notes={notes}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            router.refresh();
          }}
          onFeedback={onFeedback}
        />
      ) : null}
      <OperationalFeedbackDialog
        feedback={actionFeedback}
        onClose={() => setActionFeedback(null)}
      />
    </>
  );
}

function PaymentMethodPrompt({
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
      className="fixed inset-0 z-[300] flex touch-none items-center justify-center overflow-hidden overscroll-none bg-black/75 px-4 py-5 backdrop-blur-md"
      onClick={onClose}
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
    >
      <div
        className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,22,32,0.98),rgba(8,12,20,0.98))] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
          Pagamento
        </p>
        <h3 className="mt-2 text-2xl font-black">Como o cliente pagou?</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Essa forma fica marcada no atendimento concluido e entra no resumo financeiro.
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

function BarberEditAppointmentModal({
  appointmentId,
  isCompletedEdit,
  services,
  extras,
  currentServiceIds,
  currentExtraProductIds,
  notes,
  onClose,
  onSaved,
  onFeedback,
}: {
  appointmentId: string;
  isCompletedEdit: boolean;
  services: NonNullable<BarberAppointmentActionsProps["services"]>;
  extras: NonNullable<BarberAppointmentActionsProps["extras"]>;
  currentServiceIds: string[];
  currentExtraProductIds: string[];
  notes: string | null;
  onClose: () => void;
  onSaved: () => void;
  onFeedback: (feedback: Feedback) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const [dialogFeedback, setDialogFeedback] =
    useState<OperationalFeedbackState>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState(currentServiceIds);
  const [selectedExtraIds, setSelectedExtraIds] = useState(currentExtraProductIds);
  const total = useMemo(() => {
    const serviceTotal = services
      .filter((service) => selectedServiceIds.includes(service.id))
      .reduce((sum, service) => sum + service.price, 0);
    const extrasTotal = extras
      .filter((extra) => selectedExtraIds.includes(extra.id))
      .reduce((sum, extra) => sum + extra.price, 0);

    return serviceTotal + extrasTotal;
  }, [extras, selectedExtraIds, selectedServiceIds, services]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  }

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((current) =>
      current.includes(extraId)
        ? current.filter((id) => id !== extraId)
        : [...current, extraId]
    );
  }

  function submitEdit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = isCompletedEdit
          ? await editCompletedBarberFinanceAppointmentAction(formData)
          : await editOpenBarberAppointmentAction(formData);
        onFeedback({ message: result.message, tone: result.tone });

        if (result.ok) {
          setDialogFeedback(null);
          onSaved();
        } else {
          setDialogFeedback({
            title: "Nao foi possivel salvar",
            message: result.message,
            tone: "error",
          });
        }
      } catch {
        onFeedback({
          message: "Nao foi possivel salvar as alteracoes. Tente novamente.",
          tone: "error",
        });
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
    <div className="fixed inset-0 z-[280] flex items-center justify-center overflow-hidden overscroll-none bg-black/75 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6">
      <form
        action={submitEdit}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,22,32,0.98),rgba(8,12,20,0.98))] text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <div className="border-b border-white/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                {isCompletedEdit ? "Financeiro" : "Atendimento aberto"}
              </p>
              <h3 className="mt-2 text-xl font-bold">
                {isCompletedEdit ? "Editar itens concluidos" : "Editar itens"}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                {isCompletedEdit
                  ? "Ajuste servicos, extras e observacoes sem reabrir o atendimento."
                  : "Ajuste servicos, extras e observacoes antes de salvar."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.06]"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              Total atualizado
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {formatCurrency(total)}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Servicos
            </p>
            <div className="mt-2 grid gap-2">
              {services.map((service) => {
                const checked = selectedServiceIds.includes(service.id);

                return (
                  <label
                    key={service.id}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                      checked
                        ? "border-[var(--brand)]/70 bg-[var(--brand-muted)]"
                        : "border-white/10 bg-white/[0.035]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="serviceIds"
                      value={service.id}
                      checked={checked}
                      onChange={() => toggleService(service.id)}
                      className="h-5 w-5 shrink-0 accent-[var(--brand)]"
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
                );
              })}
            </div>
          </div>

          <details className="group rounded-2xl border border-white/10 bg-white/[0.025]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-[var(--brand-strong)]/25 bg-[var(--brand)]/10 px-3 py-2.5 transition hover:border-[var(--brand-strong)]/45 hover:bg-[var(--brand)]/15 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20 text-[var(--brand-strong)]">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-[0.18em] text-white">
                    Extras
                  </span>
                  <span className="block text-xs font-semibold text-zinc-400">
                    Clique para escolher produtos extras
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black text-[var(--brand-strong)]">
                  {selectedExtraIds.length}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180 group-open:text-white" />
              </span>
            </summary>
            <div className="grid gap-2 border-t border-white/10 p-3">
              {extras.map((extra) => {
                const checked = selectedExtraIds.includes(extra.id);

                return (
                  <label
                    key={extra.id}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                      checked
                        ? "border-[var(--brand)]/70 bg-[var(--brand-muted)]"
                        : "border-white/10 bg-white/[0.035]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="extraProductIds"
                      value={extra.id}
                      checked={checked}
                      onChange={() => toggleExtra(extra.id)}
                      className="h-5 w-5 shrink-0 accent-[var(--brand)]"
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
                );
              })}
            </div>
          </details>

          <label className="block text-sm font-semibold text-zinc-200">
            Observacoes
            <textarea
              name="notes"
              rows={4}
              maxLength={400}
              defaultValue={notes || ""}
              className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-white outline-none transition focus:border-[var(--brand)]/70"
            />
          </label>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-400">Total</span>
            <strong className="text-lg tabular-nums text-white">
              {formatCurrency(total)}
            </strong>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="min-h-12 rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-12 rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>
      <OperationalFeedbackDialog
        feedback={dialogFeedback}
        onClose={() => setDialogFeedback(null)}
      />
    </div>,
    document.body
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  pending,
  disabled,
  variant,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  pending: boolean;
  disabled: boolean;
  variant: "primary" | "secondary" | "warning" | "danger";
}) {
  const classes = {
    primary:
      "border border-sky-300/30 bg-[linear-gradient(135deg,var(--brand),#38bdf8)] text-white shadow-[0_12px_30px_rgba(14,165,233,0.28)] hover:brightness-110",
    secondary:
      "border border-white/10 bg-white/[0.035] text-zinc-100 hover:border-white/20 hover:bg-white/[0.07]",
    warning:
      "border border-amber-300/30 bg-amber-400/10 text-amber-100 hover:border-amber-200/45 hover:bg-amber-400/15",
    danger:
      "border border-red-400/35 bg-red-500/10 text-red-100 hover:border-red-300/50 hover:bg-red-500/15",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 ${classes[variant]}`}
    >
      {pending ? null : icon}
      <span className="truncate">{pending ? "Salvando..." : children}</span>
    </button>
  );
}
