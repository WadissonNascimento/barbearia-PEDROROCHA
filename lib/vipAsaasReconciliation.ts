import "server-only";

import {
  createAsaasCustomer,
  createAsaasPayment,
  createAsaasVipSubscription,
  findAsaasCustomer,
  findAsaasPayment,
  findAsaasSubscription,
  getAsaasPayment,
  getVipAsaasExternalReference,
  isAsaasVipBillingConfigured,
  listAsaasSubscriptionPayments,
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

function reconciliationEventId(payment: AsaasPayment) {
  const version = payment.confirmedDate || payment.paymentDate || payment.dueDate;
  return `reconcile:${payment.id}:${payment.status}:${version}`;
}

export async function reconcileVipAsaasSubscriptions(input: {
  shopId?: string;
  customerId?: string;
  card?: AsaasCreditCardData;
} = {}) {
  if (!isAsaasVipBillingConfigured()) {
    return { configured: false, checked: 0, linked: 0, skipped: 0, failed: 0 };
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

  for (const subscription of subscriptions) {
    try {
      const frozenDueDate = subscription.asaasFirstDueDate;
      const firstDueDate =
        frozenDueDate || resolveVipMigrationDueDate(subscription.dueDay, subscription.payments, today);
      const firstDueCycleMonth = firstDueDate.toISOString().slice(0, 7);
      const firstDuePayment = subscription.payments.find(
        (payment) => payment.cycleMonth === firstDueCycleMonth
      );

      if (!frozenDueDate) {
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

      // Asaas does not accept a new charge with a past due date. Preserve the
      // original cycle locally and issue a standalone charge due today.
      const firstDueValue = firstDueDate.toISOString().slice(0, 10);
      const firstRenewalIsSettled = isVipRenewalPaymentSettled(
        firstDuePayment
      );
      if (firstDueValue < today && !firstRenewalIsSettled) {
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

      for (const payment of await listAsaasSubscriptionPayments(asaasSubscriptionId)) {
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
      console.error(
        `[vip-asaas] Falha ao conciliar assinatura ${subscription.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return { configured: true, checked: subscriptions.length, linked, skipped, failed };
}
