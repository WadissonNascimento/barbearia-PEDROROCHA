import "server-only";

import { createAppNotificationSafely } from "@/lib/appNotifications";
import { getShopAppUrl } from "@/lib/appUrl";
import { sendEmailMessage } from "@/lib/mail";
import { basePrisma } from "@/lib/prisma-core";
import {
  getCurrentScheduleDateValue,
  getScheduleDateValue,
} from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";
import { getVipCycle, getVipPaymentDueDate } from "@/lib/vip";

const VIP_PAYMENT_ADVANCE_DAYS = 3;

function parseScheduleDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVipPaymentEmail({
  customerName,
  shopName,
  planName,
  amount,
  dueDateLabel,
  actionUrl,
  isDueToday,
}: {
  customerName: string;
  shopName: string;
  planName: string;
  amount: string;
  dueDateLabel: string;
  actionUrl: string;
  isDueToday: boolean;
}) {
  const title = isDueToday
    ? "Seu plano mensal vence hoje"
    : "Seu plano mensal esta perto do vencimento";
  const escapedTitle = escapeHtml(title);

  return `
    <div style="margin:0;padding:28px;background:#050504;color:#f5efe3;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(184,148,95,.35);border-radius:22px;overflow:hidden;background:#0b0a09;">
        <div style="padding:26px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(135deg,rgba(184,148,95,.18),rgba(8,8,7,.98));">
          <p style="margin:0 0 12px;color:#e8c57d;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">${escapeHtml(shopName)}</p>
          <h1 style="margin:0;color:#fff;font-size:28px;line-height:1.15;">${escapedTitle}</h1>
        </div>
        <div style="padding:26px;color:#d7cec0;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 16px;">Ola, ${escapeHtml(customerName)}.</p>
          <p style="margin:0 0 16px;">O plano ${escapeHtml(planName)} tem vencimento em <strong style="color:#fff;">${escapeHtml(dueDateLabel)}</strong>.</p>
          <p style="margin:0 0 22px;">Valor mensal: <strong style="color:#fff;">${escapeHtml(amount)}</strong>.</p>
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:12px;background:#f1e8d8;color:#080807;padding:13px 18px;text-decoration:none;font-weight:800;">Ver meu plano</a>
        </div>
      </div>
    </div>
  `;
}

export async function sendVipPaymentDueNotifications() {
  const todayValue = getCurrentScheduleDateValue();
  const todayDate = parseScheduleDateValue(todayValue);
  const { cycleMonth } = getVipCycle(todayDate);
  const subscriptions = await basePrisma.vipSubscription.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      plan: true,
      shop: {
        select: {
          id: true,
          name: true,
          primaryDomain: true,
          emailSettings: {
            select: {
              fromName: true,
            },
          },
        },
      },
      payments: {
        where: {
          cycleMonth,
        },
        take: 1,
      },
    },
  });

  let checked = 0;
  let notified = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    checked += 1;
    const dueDate = getVipPaymentDueDate(todayDate, subscription.dueDay);
    const dueDateValue = getScheduleDateValue(dueDate);
    const advanceDateValue = getScheduleDateValue(
      addUtcDays(dueDate, -VIP_PAYMENT_ADVANCE_DAYS)
    );
    const kind =
      todayValue === dueDateValue
        ? "due"
        : todayValue === advanceDateValue
        ? "advance"
        : null;

    await basePrisma.vipPayment.upsert({
      where: {
        shopId_subscriptionId_cycleMonth: {
          shopId: subscription.shopId,
          subscriptionId: subscription.id,
          cycleMonth,
        },
      },
      update: {
        dueDate,
        amount: subscription.plan.price,
        notes: `Vence todo dia ${subscription.dueDay}`,
      },
      create: {
        shopId: subscription.shopId,
        subscriptionId: subscription.id,
        cycleMonth,
        amount: subscription.plan.price,
        status: "PENDING",
        dueDate,
        notes: `Vence todo dia ${subscription.dueDay}`,
      },
    });

    if (!kind || subscription.payments[0]?.status === "PAID") {
      skipped += 1;
      continue;
    }

    const dueDateLabel = formatDateLabel(dueDate);
    const planUrl = `${getShopAppUrl(subscription.shop)}/planos`;
    const amountLabel = formatCurrency(Number(subscription.plan.price));
    const customerName =
      subscription.customer.name?.trim() ||
      subscription.customer.email?.split("@")[0] ||
      "cliente";
    const isDueToday = kind === "due";
    const title = isDueToday
      ? "Seu plano mensal vence hoje"
      : "Seu plano mensal esta perto do vencimento";
    const body = isDueToday
      ? `O plano ${subscription.plan.name} vence hoje. Valor: ${amountLabel}.`
      : `Seu plano ${subscription.plan.name} vence em ${dueDateLabel}. Valor: ${amountLabel}.`;
    const eventKey = `vip-payment-${kind}-${subscription.id}-${cycleMonth}`;

    const notification = await createAppNotificationSafely({
      shopId: subscription.shopId,
      recipientUserId: subscription.customer.id,
      type: "vip_payment_due",
      eventKey,
      eyebrow: "Plano mensal",
      title,
      body,
      actionUrl: "/planos",
      metadata: {
        subscriptionId: subscription.id,
        planName: subscription.plan.name,
        cycleMonth,
        dueDay: subscription.dueDay,
        dueDate: dueDateValue,
        amount: Number(subscription.plan.price),
      },
    });

    if (notification) {
      notified += 1;
    }

    if (!subscription.customer.email) {
      skipped += 1;
      continue;
    }

    try {
      const result = await sendEmailMessage({
        to: subscription.customer.email,
        subject: `${title} - ${subscription.shop.name}`,
        text: `${title}. O plano ${subscription.plan.name} vence em ${dueDateLabel}. Valor: ${amountLabel}.`,
        html: renderVipPaymentEmail({
          customerName,
          shopName:
            subscription.shop.emailSettings?.fromName?.trim() ||
            subscription.shop.name,
          planName: subscription.plan.name,
          amount: amountLabel,
          dueDateLabel,
          actionUrl: planUrl,
          isDueToday,
        }),
        template: "vip-payment-due",
        eventKey,
        shopId: subscription.shopId,
        recipientUserId: subscription.customer.id,
        fromName:
          subscription.shop.emailSettings?.fromName?.trim() ||
          subscription.shop.name,
        metadata: {
          subscriptionId: subscription.id,
          cycleMonth,
          dueDay: subscription.dueDay,
          dueDate: dueDateValue,
          kind,
        },
      });

      if (result.sent) {
        sent += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `[vip-payment] Falha ao enviar aviso ${eventKey}: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`
      );
    }
  }

  return {
    checked,
    notified,
    sent,
    failed,
    skipped,
    date: todayValue,
  };
}
