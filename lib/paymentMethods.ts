export const APPOINTMENT_PAYMENT_METHODS = ["PIX", "CASH", "CARD"] as const;

export type AppointmentPaymentMethod =
  (typeof APPOINTMENT_PAYMENT_METHODS)[number];

const PAYMENT_METHOD_LABELS: Record<AppointmentPaymentMethod, string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  CARD: "Cartao",
};

export type PaymentBreakdown = Record<AppointmentPaymentMethod | "UNKNOWN", number>;

export function normalizePaymentMethod(
  value: FormDataEntryValue | string | null | undefined
): AppointmentPaymentMethod | null {
  const normalized = String(value || "").trim().toUpperCase();

  return APPOINTMENT_PAYMENT_METHODS.includes(
    normalized as AppointmentPaymentMethod
  )
    ? (normalized as AppointmentPaymentMethod)
    : null;
}

export function paymentMethodLabel(value: string | null | undefined) {
  const normalized = normalizePaymentMethod(value);

  return normalized ? PAYMENT_METHOD_LABELS[normalized] : "Nao informado";
}

export function createEmptyPaymentBreakdown(): PaymentBreakdown {
  return {
    PIX: 0,
    CASH: 0,
    CARD: 0,
    UNKNOWN: 0,
  };
}

export function addToPaymentBreakdown(
  breakdown: PaymentBreakdown,
  paymentMethod: string | null | undefined,
  amount: number
) {
  const normalized = normalizePaymentMethod(paymentMethod);
  breakdown[normalized || "UNKNOWN"] += amount;
}
