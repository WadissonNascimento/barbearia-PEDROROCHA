import "server-only";

import { Prisma } from "@prisma/client";
import {
  AsaasApiError,
  getAsaasPayment,
  getAsaasPixQrCode,
  updateAsaasPayment,
  type AsaasPayment,
} from "@/lib/asaas";
import { basePrisma } from "@/lib/prisma-core";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import { resolveVipPolicyDueDate } from "@/lib/vipDueDate";
import { isEditableAsaasPayment } from "@/lib/vipBillingPolicy";

type AsaasWebhookPayment = Partial<AsaasPayment>;

export type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  payment?: AsaasWebhookPayment;
};

const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

function getCycleMonthFromDueDate(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : null;
}

function parseAsaasDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPaidAt(payment: AsaasWebhookPayment) {
  return (
    parseAsaasDate(payment.confirmedDate) ||
    parseAsaasDate(payment.paymentDate) ||
    new Date()
  );
}

export async function processAsaasVipWebhook(payload: AsaasWebhookPayload) {
  const eventId = payload.id?.trim();
  const event = payload.event?.trim();
  const deliveredPayment = payload.payment;
  const asaasPaymentId = deliveredPayment?.id?.trim();
  const deliveredSubscriptionId = deliveredPayment?.subscription?.trim();

  if (!eventId || !event || !asaasPaymentId) {
    throw new Error("Evento do Asaas inválido: id, event e payment.id são obrigatórios.");
  }

  const subscription = await basePrisma.vipSubscription.findFirst({
    where: {
      OR: [
        deliveredSubscriptionId ? { asaasSubscriptionId: deliveredSubscriptionId } : undefined,
        { payments: { some: { asaasPaymentId } } },
      ].filter(Boolean) as Prisma.VipSubscriptionWhereInput[],
    },
    include: { plan: true },
  });

  // The same Asaas account may receive events from the system's own billing.
  if (!subscription) return { ignored: true, reason: "not-a-vip-payment" as const };

  const previousEvent = await basePrisma.asaasWebhookEvent.findUnique({
    where: { asaasEventId: eventId },
    select: { processedAt: true },
  });
  if (previousEvent?.processedAt) return { ignored: true, reason: "duplicate" as const };
  if (previousEvent) {
    await basePrisma.asaasWebhookEvent.delete({ where: { asaasEventId: eventId } });
  }

  try {
    await basePrisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subscription.id}))`;

        let payment: AsaasWebhookPayment;
        try {
          payment = await getAsaasPayment(asaasPaymentId);
        } catch (error) {
          if (!(event === "PAYMENT_DELETED" && error instanceof AsaasApiError && error.status === 404)) {
            throw error;
          }
          payment = { ...deliveredPayment, id: asaasPaymentId, status: "DELETED" };
        }

        if (
          payment.subscription &&
          subscription.asaasSubscriptionId &&
          payment.subscription !== subscription.asaasSubscriptionId
        ) {
          throw new Error("Cobrança não pertence à assinatura VIP.");
        }

        const existingProviderPayment = await tx.vipPayment.findUnique({
          where: { asaasPaymentId },
          select: {
            cycleMonth: true,
            dueDate: true,
            status: true,
            asaasStatus: true,
            externalReference: true,
          },
        });
        const now = new Date();
        // Asaas repeats calendar dates. Correct a generated future recurring
        // charge at creation/update, rather than waiting for its debit day.
        if (subscription.dueDay === 5 && payment.subscription && payment.dueDate && payment.billingType && payment.value !== undefined && isEditableAsaasPayment(payment.status || "") && existingProviderPayment?.status !== "PAID") {
          const adjusted = resolveVipPolicyDueDate(new Date(`${payment.dueDate}T12:00:00Z`), 5, getCurrentScheduleDateValue(now)).toISOString().slice(0, 10);
          if (adjusted !== payment.dueDate) {
            payment = await updateAsaasPayment(asaasPaymentId, { billingType: payment.billingType, value: payment.value, dueDate: adjusted });
          }
        }
        const providerStatus = payment.status || event;
        // A manual confirmation made by the shop owner is authoritative. A
        // delayed provider event must not turn that monthly fee back to pending.
        const manuallyConfirmed =
          existingProviderPayment?.status === "PAID" &&
          existingProviderPayment.asaasStatus === "PAID_MANUALLY";
        const localStatus =
          PAID_STATUSES.has(providerStatus) || manuallyConfirmed ? "PAID" : "PENDING";
        // Standalone migration charges can be issued today for an older cycle,
        // because Asaas rejects creating a new charge with a past due date.
        const cycleMonth =
          existingProviderPayment?.cycleMonth || getCycleMonthFromDueDate(payment.dueDate);
        const preserveOriginalDue = !payment.subscription || existingProviderPayment?.status === "PAID";
        const dueDate = preserveOriginalDue
          ? existingProviderPayment?.dueDate || parseAsaasDate(payment.dueDate)
          : parseAsaasDate(payment.dueDate) || existingProviderPayment?.dueDate;

        await tx.asaasWebhookEvent.create({
          data: {
            shopId: subscription.shopId,
            asaasEventId: eventId,
            event,
            asaasPaymentId,
            asaasSubscriptionId: deliveredSubscriptionId || subscription.asaasSubscriptionId,
            // Keep audit metadata, never provider card tokens or full payloads.
            payload: { id: eventId, event, payment: { id: asaasPaymentId, status: payment.status, dueDate: payment.dueDate, subscription: payment.subscription } } as Prisma.InputJsonValue,
          },
        });

        await tx.vipSubscription.update({
          where: { id: subscription.id },
          data: { asaasStatus: providerStatus, lastAsaasSyncAt: now },
        });

        if (event === "PAYMENT_DELETED" && (!cycleMonth || !dueDate)) {
          await tx.vipPayment.updateMany({
            where: { subscriptionId: subscription.id, asaasPaymentId },
            data: {
              status: "PENDING",
              paidAt: null,
              asaasStatus: "DELETED",
              lastAsaasEventAt: now,
            },
          });
        } else {
          if (!cycleMonth || !dueDate) throw new Error("Vencimento inválido no Asaas.");

          const paymentData = {
            amount: payment.value ?? subscription.plan.price,
            dueDate,
            asaasPaymentId,
            asaasStatus:
              manuallyConfirmed && !PAID_STATUSES.has(providerStatus)
                ? "PAID_MANUALLY"
                : providerStatus,
            invoiceUrl: payment.invoiceUrl || null,
            bankSlipUrl: payment.bankSlipUrl || null,
            externalReference: payment.externalReference || null,
            lastAsaasEventAt: now,
          };

          let pixData: { pixQrCode?: string; pixCopyPaste?: string } = {};
          if (
            localStatus !== "PAID" &&
            payment.billingType === "PIX"
          ) {
            const pix = await getAsaasPixQrCode(asaasPaymentId);
            pixData = {
              pixQrCode: pix.encodedImage || undefined,
              pixCopyPaste: pix.payload || undefined,
            };
          }

          await tx.vipPayment.upsert({
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
              status: localStatus,
              paidAt: localStatus === "PAID" ? getPaidAt(payment) : null,
              notes: `Cobrança sincronizada pelo Asaas (${event}).`,
              ...paymentData,
              ...pixData,
            },
            update: {
              ...paymentData,
              ...pixData,
              status: localStatus,
              paidAt: localStatus === "PAID" ? getPaidAt(payment) : null,
            },
          });
        }

        await tx.asaasWebhookEvent.update({
          where: { asaasEventId: eventId },
          data: { processedAt: new Date(), processingError: null },
        });
      },
      { timeout: 30_000 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await basePrisma.asaasWebhookEvent.findUnique({
        where: { asaasEventId: eventId },
        select: { processedAt: true },
      });
      if (duplicate?.processedAt) return { ignored: true, reason: "duplicate" as const };
    }
    throw error;
  }

  return { ignored: false, subscriptionId: subscription.id, event };
}
