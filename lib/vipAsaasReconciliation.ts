import "server-only";

import {
  createAsaasCustomer,
  createAsaasPayment,
  createAsaasVipSubscription,
  findAsaasCustomer,
  findAsaasPayment,
  findAsaasSubscription,
  getAsaasPayment,
  getAsaasSubscription,
  getVipAsaasExternalReference,
  isAsaasVipBillingConfigured,
  listAsaasSubscriptionPayments,
  updateAsaasPayment,
  updateAsaasVipSubscription,
  type AsaasPayment,
  type AsaasCreditCardData,
  type VipAsaasBillingType,
} from "@/lib/asaas";
import { processAsaasVipWebhook } from "@/lib/asaasVipWebhook";
import { basePrisma } from "@/lib/prisma-core";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import { getVipCycle } from "@/lib/vip";
import {
  isVipRenewalPaymentSettled,
  resolveAsaasRecurringDueDate,
  resolveVipMigrationDueDate,
  shouldExpireLegacyRenewal,
} from "@/lib/vipMigration";
import { resolveVipPolicyDueDate } from "@/lib/vipDueDate";
import { isEditableAsaasPayment } from "@/lib/vipBillingPolicy";
import { getVipBillingErrorMessage } from "@/lib/vipBillingErrors";

function reconciliationEventId(payment: AsaasPayment) {
  const version = [payment.confirmedDate, payment.paymentDate, payment.dueDate, payment.billingType, payment.value].join(":");
  return `reconcile:${payment.id}:${payment.status}:${version}`;
}

export async function reconcileVipAsaasSubscriptions(input: {
  shopId?: string;
  customerId?: string;
  card?: AsaasCreditCardData;
  billingUpdateLease?: Date;
  skipStandaloneCreation?: boolean;
} = {}) {
  if (!isAsaasVipBillingConfigured()) {
    return { configured: false, checked: 0, linked: 0, skipped: 0, failed: 0, errors: [] as string[] };
  }

  const subscriptions = await basePrisma.vipSubscription.findMany({
    where: {
      status: "ACTIVE",
      ...(input.shopId ? { shopId: input.shopId } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          customerProfile: { select: { cpfCnpj: true } },
        },
      },
      plan: true,
      payments: { orderBy: { cycleMonth: "desc" }, take: 12 },
    },
  });

  const today = getCurrentScheduleDateValue();
  const todayDate = new Date(`${today}T12:00:00.000Z`);
  let linked = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const subscription of subscriptions) {
    const lease = input.billingUpdateLease || new Date();
    if (input.billingUpdateLease) {
      if (!subscription.billingUpdateStartedAt || subscription.billingUpdateStartedAt.getTime() !== lease.getTime()) {
        skipped += 1;
        continue;
      }
    } else {
      const claimed = await basePrisma.vipSubscription.updateMany({
        where: {
          id: subscription.id,
          OR: [{ billingUpdateStartedAt: null }, { billingUpdateStartedAt: { lt: new Date(lease.getTime() - 10 * 60_000) } }],
        },
        data: { billingUpdateStartedAt: lease },
      });
      if (!claimed.count) { skipped += 1; continue; }
    }
    try {
      const frozenDueDate = subscription.asaasFirstDueDate;
      const originalFirstDueDate =
        frozenDueDate || resolveVipMigrationDueDate(subscription.dueDay, subscription.payments, today);
      const frozenCyclePaid = subscription.payments.some(payment => payment.cycleMonth === originalFirstDueDate.toISOString().slice(0, 7) && payment.status === "PAID");
      const firstDueDate = frozenCyclePaid ? originalFirstDueDate : resolveVipPolicyDueDate(originalFirstDueDate, subscription.dueDay, today);
      const firstDueCycleMonth = firstDueDate.toISOString().slice(0, 7);
      const firstDuePayment = subscription.payments.find(
        (payment) => payment.cycleMonth === firstDueCycleMonth
      );

      if (!frozenDueDate || firstDueDate.getTime() !== frozenDueDate.getTime()) {
        await basePrisma.vipSubscription.update({
          where: { id: subscription.id },
          data: { asaasFirstDueDate: firstDueDate },
        });
      }

      if (!subscription.asaasSubscriptionId && firstDuePayment && shouldExpireLegacyRenewal(firstDuePayment, firstDueDate, today)) {
        const expired = await basePrisma.vipPayment.updateMany({
          where: { id: firstDuePayment.id, status: "PAID", paidAt: firstDuePayment.paidAt, asaasPaymentId: null, updatedAt: firstDuePayment.updatedAt },
          data: {
            status: "PENDING",
            // Preserve the original payment date as historical evidence.
            notes: `Renovação vencida em ${firstDueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Pagamento anterior: ${firstDuePayment.paidAt?.toISOString()}.`,
          },
        });
        if (!expired.count) { skipped += 1; continue; }
        firstDuePayment.status = "PENDING";
      }

      const cpfCnpj = subscription.customer.customerProfile?.cpfCnpj?.trim();
      const billingType = subscription.asaasBillingType as VipAsaasBillingType | null;
      if (!cpfCnpj || !billingType) {
        skipped += 1;
        continue;
      }
      // A scheduled reconciliation must not opt a legacy client into a payment
      // method they have not confirmed. Linked recurrences still get synced.
      if (!subscription.asaasSubscriptionId && !input.billingUpdateLease && !subscription.billingProfileConfirmedAt) {
        skipped += 1;
        continue;
      }

      let asaasCustomerId = subscription.asaasCustomerId;
      if (!asaasCustomerId) {
        const customerReference = `vip-customer:${subscription.shopId}:${subscription.customerId}`;
        const customer =
          (await findAsaasCustomer(customerReference)) ||
          (await createAsaasCustomer({
            name: subscription.customer.name || subscription.customer.email || "Cliente VIP",
            email: subscription.customer.email,
            phone: subscription.customer.phone,
            cpfCnpj,
            externalReference: customerReference,
          }));
        asaasCustomerId = customer.id;
        await basePrisma.vipSubscription.update({
          where: { id: subscription.id },
          data: {
            asaasCustomerId,
            asaasStatus: "CUSTOMER_CREATED",
            lastAsaasSyncAt: new Date(),
          },
        });
      }

      let asaasSubscriptionId = subscription.asaasSubscriptionId;
      if (!asaasSubscriptionId) {
        if (billingType === "CREDIT_CARD" && !input.card) {
          skipped += 1;
          continue;
        }
        const reference = getVipAsaasExternalReference(subscription.shopId, subscription.id);
        const recurringDueDate = resolveAsaasRecurringDueDate(
          firstDueDate,
          subscription.dueDay,
          today
        );
        const asaasSubscription =
          (await findAsaasSubscription(reference)) ||
          (await createAsaasVipSubscription({
            customerId: asaasCustomerId,
            billingType,
            value: Number(subscription.plan.price),
            nextDueDate: recurringDueDate,
            description: `Plano VIP ${subscription.plan.name}`,
            externalReference: reference,
            card: input.card,
          }));
        asaasSubscriptionId = asaasSubscription.id;
        await basePrisma.vipSubscription.update({
          where: { id: subscription.id },
          data: {
            asaasSubscriptionId,
            asaasBillingType: asaasSubscription.billingType,
            asaasStatus: asaasSubscription.status,
            lastAsaasSyncAt: new Date(),
          },
        });
        linked += 1;
      }

      const recurringPayments = await listAsaasSubscriptionPayments(asaasSubscriptionId);

      // Asaas does not accept a new charge with a past due date. Preserve the
      // original cycle locally and issue a standalone charge due today.
      const firstDueValue = firstDueDate.toISOString().slice(0, 10);
      const firstRenewalIsSettled = isVipRenewalPaymentSettled(
        firstDuePayment
      );
      const recurringFirstCycleExists = recurringPayments.some(payment => payment.dueDate.slice(0, 7) === firstDueCycleMonth && payment.status !== "DELETED");
      if (!input.skipStandaloneCreation && firstDueValue < today && !firstRenewalIsSettled && !firstDuePayment?.asaasPaymentId && !recurringFirstCycleExists) {
        const cycleMonth = firstDueValue.slice(0, 7);
        const paymentReference = `vip-payment:${subscription.shopId}:${subscription.id}:${cycleMonth}`;
        let overduePayment = await findAsaasPayment(paymentReference);
        if (!overduePayment && billingType === "CREDIT_CARD" && !input.card) {
          skipped += 1;
          continue;
        }
        overduePayment = overduePayment || await createAsaasPayment({
            customerId: asaasCustomerId,
            billingType,
            value: Number(subscription.plan.price),
            dueDate: todayDate,
            description: `Plano VIP ${subscription.plan.name} - competência ${cycleMonth}`,
            externalReference: paymentReference,
            card: input.card,
          });

        await basePrisma.vipPayment.upsert({
          where: {
            shopId_subscriptionId_cycleMonth: {
              shopId: subscription.shopId,
              subscriptionId: subscription.id,
              cycleMonth,
            },
          },
          create: {
            shopId: subscription.shopId,
            subscriptionId: subscription.id,
            cycleMonth,
            amount: subscription.plan.price,
            status: "PENDING",
            dueDate: firstDueDate,
            asaasPaymentId: overduePayment.id,
            asaasStatus: overduePayment.status,
            invoiceUrl: overduePayment.invoiceUrl || null,
            bankSlipUrl: overduePayment.bankSlipUrl || null,
            externalReference: paymentReference,
            notes: "Cobrança vencida migrada para o Asaas.",
          },
          update: {
            asaasPaymentId: overduePayment.id,
            asaasStatus: overduePayment.status,
            invoiceUrl: overduePayment.invoiceUrl || null,
            bankSlipUrl: overduePayment.bankSlipUrl || null,
            externalReference: paymentReference,
          },
        });
        await processAsaasVipWebhook({
          id: reconciliationEventId(overduePayment),
          event: "PAYMENT_UPDATED",
          payment: overduePayment,
        });
      }

      if (subscription.dueDay === 5) {
        const remote = await getAsaasSubscription(asaasSubscriptionId);
        const adjustedNextDue = resolveVipPolicyDueDate(new Date(`${remote.nextDueDate}T12:00:00.000Z`), subscription.dueDay, today);
        if (remote.nextDueDate !== adjustedNextDue.toISOString().slice(0, 10)) {
          await updateAsaasVipSubscription(asaasSubscriptionId, { nextDueDate: adjustedNextDue, updatePendingPayments: false });
        }
      }

      for (let payment of recurringPayments) {
        // Monthly Asaas recurrences repeat a calendar day, not an nth business
        // day. Correct each generated future invoice before its debit date.
        const localPayment = subscription.payments.find(item => item.asaasPaymentId === payment.id || item.cycleMonth === payment.dueDate.slice(0, 7));
        if (subscription.dueDay === 5 && isEditableAsaasPayment(payment.status) && localPayment?.status !== "PAID") {
          const policyDue = resolveVipPolicyDueDate(new Date(`${payment.dueDate}T12:00:00.000Z`), 5, today).toISOString().slice(0, 10);
          if (policyDue !== payment.dueDate) {
            payment = await updateAsaasPayment(payment.id, { billingType: payment.billingType || billingType, value: payment.value, dueDate: policyDue });
          }
        }
        await processAsaasVipWebhook({
          id: reconciliationEventId(payment),
          event: "PAYMENT_UPDATED",
          payment,
        });
      }

      // Recheck standalone charges that do not appear in subscription payments.
      for (const localPayment of subscription.payments) {
        if (!localPayment.asaasPaymentId || localPayment.externalReference?.startsWith("vip-payment:") !== true) continue;
        const payment = await getAsaasPayment(localPayment.asaasPaymentId);
        await processAsaasVipWebhook({
          id: reconciliationEventId(payment),
          event: "PAYMENT_UPDATED",
          payment,
        });
      }

      const { start, end } = getVipCycle();
      await basePrisma.vipSubscription.updateMany({
        where: { id: subscription.id, status: "ACTIVE", cycleEnd: { lte: start } },
        data: {
          cycleStart: start,
          cycleEnd: end,
          tokensRemaining: subscription.plan.tokensPerCycle,
        },
      });
    } catch (error) {
      failed += 1;
      errors.push(getVipBillingErrorMessage(error));
      console.error(
        `[vip-asaas] Falha ao conciliar assinatura ${subscription.id}:`,
        error instanceof Error ? error.name : "UnknownError"
      );
    } finally {
      if (!input.billingUpdateLease) {
        await basePrisma.vipSubscription.updateMany({ where: { id: subscription.id, billingUpdateStartedAt: lease }, data: { billingUpdateStartedAt: null } });
      }
    }
  }

  return { configured: true, checked: subscriptions.length, linked, skipped, failed, errors };
}
