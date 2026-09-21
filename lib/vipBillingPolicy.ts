export const VIP_BILLING_TYPES = ["PIX", "BOLETO", "CREDIT_CARD"] as const;
export type VipBillingType = (typeof VIP_BILLING_TYPES)[number];
const VIP_SELECTABLE_BILLING_TYPES: readonly VipBillingType[] = ["BOLETO", "CREDIT_CARD"];

function readRuntimeEnv(name: "VIP_ASAAS_PAYMENTS_ENABLED") {
  return process.env[name]?.trim();
}

export function isVipAsaasPaymentsEnabled() {
  return readRuntimeEnv("VIP_ASAAS_PAYMENTS_ENABLED")?.toLowerCase() !== "false";
}

export function parseVipBillingType(value: unknown): VipBillingType {
  if (!VIP_SELECTABLE_BILLING_TYPES.includes(value as VipBillingType)) {
    throw new Error("Escolha como deseja pagar: boleto ou cartão de crédito.");
  }
  return value as VipBillingType;
}

export function needsVipBillingUpdate(subscription: {
  asaasSubscriptionId?: string | null;
  billingProfileConfirmedAt?: Date | string | null;
}) {
  return !subscription.asaasSubscriptionId || !subscription.billingProfileConfirmedAt;
}

export function isEditableAsaasPayment(status: string) {
  return status === "PENDING" || status === "OVERDUE";
}
