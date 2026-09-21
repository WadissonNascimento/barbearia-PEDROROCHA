import "server-only";

import {
  getAsaasPayment,
  getAsaasSubscription,
  listAsaasSubscriptionPayments,
  updateAsaasPayment,
  updateAsaasSubscriptionCreditCard,
  updateAsaasVipSubscription,
  type AsaasCreditCardData,
  type VipAsaasBillingType,
} from "@/lib/asaas";
import { isEditableAsaasPayment } from "@/lib/vipBillingPolicy";

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Updates the existing recurrence. Never recreates it or captures a card payment. */
export async function updateVipAsaasPreferences(input: {
  subscriptionId: string;
  billingType: VipAsaasBillingType;
  card?: AsaasCreditCardData;
  standalonePaymentIds: string[];
}) {
  const subscription = await getAsaasSubscription(input.subscriptionId);
  if (subscription.status !== "ACTIVE") {
    throw new Error("A cobrança do plano está pausada. Fale com a barbearia para reativá-la.");
  }
  if (input.billingType === "CREDIT_CARD") {
    if (!input.card) throw new Error("Informe os dados do cartão para continuar.");
    await updateAsaasSubscriptionCreditCard(input.subscriptionId, input.card);
  }
  // Reapply on retries too: a previous call may have changed the recurrence
  // before its pending invoices were updated.
  await updateAsaasVipSubscription(input.subscriptionId, {
    billingType: input.billingType,
    updatePendingPayments: true,
  });

  // Charges for historical arrears are separate from the recurrence. Change
  // their method in place too, retaining the provider due date and charge ID.
  for (const paymentId of input.standalonePaymentIds) {
    const payment = await getAsaasPayment(paymentId);
    if (!isEditableAsaasPayment(payment.status) || payment.billingType === input.billingType) continue;
    await updateAsaasPayment(payment.id, {
      billingType: input.billingType,
      value: payment.value,
      dueDate: payment.dueDate,
    });
  }

  let confirmed = await getAsaasSubscription(input.subscriptionId);
  let pending = (await listAsaasSubscriptionPayments(input.subscriptionId))
    .filter(payment => isEditableAsaasPayment(payment.status));
  for (let attempt = 0; attempt < 3 && (
    confirmed.billingType !== input.billingType ||
    pending.some(payment => payment.billingType !== input.billingType)
  ); attempt += 1) {
    await wait(350);
    confirmed = await getAsaasSubscription(input.subscriptionId);
    pending = (await listAsaasSubscriptionPayments(input.subscriptionId))
      .filter(payment => isEditableAsaasPayment(payment.status));
  }
  if (confirmed.billingType !== input.billingType) {
    throw new Error("A forma de pagamento ainda não foi confirmada. Tente novamente.");
  }
  if (pending.some(payment => payment.billingType !== input.billingType)) {
    throw new Error("Ainda existe uma cobrança com a forma de pagamento anterior. Tente novamente.");
  }
  return { subscription: confirmed, payments: pending };
}
