import type { SystemBillingPayment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createScheduleDate,
  getCurrentScheduleDateValue,
  getScheduleDateValue,
} from "@/lib/scheduleTime";
import { formatCurrency } from "@/lib/utils";

export const SYSTEM_BILLING_OWNER_EMAIL = "wadisson97.w.g@gmail.com";
export const SYSTEM_BILLING_PIX_KEY = "04378155524";
export const SYSTEM_BILLING_GRACE_DAYS = 7;
export const DEFAULT_SYSTEM_BILLING_AMOUNT = 48;

export type SystemBillingAlert = {
  paymentId: string;
  cycleMonth: string;
  amountLabel: string;
  dueDateLabel: string;
  graceDateLabel: string;
  pixKey: string;
  isOverdue: boolean;
  canMarkPaid: boolean;
} | null;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getCycleMonth(dateValue: string) {
  return dateValue.slice(0, 7);
}

function isBusinessDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function getFifthBusinessDayDate(cycleMonth: string) {
  const [yearValue, monthValue] = cycleMonth.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  let businessDays = 0;

  for (let day = 1; day <= 31; day += 1) {
    const dateValue = `${year}-${pad(month)}-${pad(day)}`;
    const date = createScheduleDate(dateValue, "00:00");

    if (!date || date.getUTCMonth() !== month - 1) {
      break;
    }

    if (isBusinessDay(date)) {
      businessDays += 1;
    }

    if (businessDays === 5) {
      return date;
    }
  }

  return createScheduleDate(`${year}-${pad(month)}-05`, "00:00")!;
}

function addCalendarDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isPaid(payment: Pick<SystemBillingPayment, "status" | "paidAt">) {
  return payment.status === "PAID" || Boolean(payment.paidAt);
}

export async function getSystemBillingAlert({
  shopId,
  userEmail,
  now = new Date(),
}: {
  shopId: string;
  userEmail?: string | null;
  now?: Date;
}): Promise<SystemBillingAlert> {
  const todayValue = getCurrentScheduleDateValue(now);
  const cycleMonth = getCycleMonth(todayValue);
  const dueDate = getFifthBusinessDayDate(cycleMonth);
  const graceEndsAt = addCalendarDays(dueDate, SYSTEM_BILLING_GRACE_DAYS);
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      subscriptionMonthlyPrice: true,
    },
  });
  const amount = Number(
    shop?.subscriptionMonthlyPrice || DEFAULT_SYSTEM_BILLING_AMOUNT
  );

  const payment = await prisma.systemBillingPayment.upsert({
    where: {
      shopId_cycleMonth: {
        shopId,
        cycleMonth,
      },
    },
    create: {
      shopId,
      cycleMonth,
      amount,
      dueDate,
      graceEndsAt,
      notes: "Mensalidade do sistema da barbearia.",
    },
    update: {
      amount,
      dueDate,
      graceEndsAt,
    },
  });

  if (isPaid(payment) || todayValue < getScheduleDateValue(dueDate)) {
    return null;
  }

  return {
    paymentId: payment.id,
    cycleMonth,
    amountLabel: formatCurrency(payment.amount),
    dueDateLabel: formatLongDate(dueDate),
    graceDateLabel: formatLongDate(graceEndsAt),
    pixKey: SYSTEM_BILLING_PIX_KEY,
    isOverdue: todayValue > getScheduleDateValue(dueDate),
    canMarkPaid:
      userEmail?.trim().toLowerCase() === SYSTEM_BILLING_OWNER_EMAIL,
  };
}
