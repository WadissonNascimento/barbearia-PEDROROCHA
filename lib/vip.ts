import { Prisma } from "@prisma/client";
import {
  getCurrentScheduleDateValue,
  getScheduleDateValue,
} from "@/lib/scheduleTime";

export const VIP_PLAN_DEFINITIONS = [
  {
    code: "CORTE",
    name: "Bronze",
    price: 120,
    tokensPerCycle: 4,
  },
  {
    code: "CORTE_SOBRANCELHA",
    name: "Prata",
    price: 140,
    tokensPerCycle: 4,
  },
  {
    code: "CORTE_BARBA_SOBRANCELHA",
    name: "Ouro",
    price: 180,
    tokensPerCycle: 4,
  },
] as const;

export type VipPlanCode = (typeof VIP_PLAN_DEFINITIONS)[number]["code"];
export const DEFAULT_VIP_DUE_DAY = 5;

export const ACTIVE_VIP_APPOINTMENT_STATUSES_FOR_WEEKLY_LIMIT = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "DONE",
];

type VipDb = Pick<
  Prisma.TransactionClient,
  "appointment" | "vipPayment" | "vipPlan" | "vipSubscription" | "vipUsage"
>;

function getCycleMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function getVipCycle(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return {
    start,
    end,
    cycleMonth: getCycleMonth(date),
  };
}

export function normalizeVipDueDay(value: unknown) {
  const parsedValue =
    typeof value === "number" ? value : Number(String(value || "").trim());

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 31) {
    throw new Error("Informe um dia de vencimento entre 1 e 31.");
  }

  return parsedValue;
}

export function getVipDueDateForMonth(date = new Date(), dueDay = DEFAULT_VIP_DUE_DAY) {
  const normalizedDueDay = normalizeVipDueDay(dueDay);
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(normalizedDueDay, lastDayOfMonth);

  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

export function getVipPlanDefinition(code: string) {
  return VIP_PLAN_DEFINITIONS.find((plan) => plan.code === code) || null;
}

export function getVipPlanItemsLabel(code: string) {
  if (code === "CORTE") {
    return "Corte";
  }

  if (code === "CORTE_SOBRANCELHA") {
    return "Corte e sobrancelha";
  }

  if (code === "CORTE_BARBA_SOBRANCELHA") {
    return "Corte, sobrancelha e barba";
  }

  return "Combo mensal";
}

export function getVipPlanDurationMinutes(code: string) {
  if (code === "CORTE") {
    return 45;
  }

  if (code === "CORTE_SOBRANCELHA") {
    return 60;
  }

  if (code === "CORTE_BARBA_SOBRANCELHA") {
    return 60;
  }

  return 45;
}

export async function ensureVipPlansForShop(db: VipDb, shopId: string) {
  await Promise.all(
    VIP_PLAN_DEFINITIONS.map((plan) =>
      db.vipPlan.upsert({
        where: {
          shopId_code: {
            shopId,
            code: plan.code,
          },
        },
        update: {
          name: plan.name,
          price: new Prisma.Decimal(plan.price),
          tokensPerCycle: plan.tokensPerCycle,
          isActive: true,
        },
        create: {
          shopId,
          code: plan.code,
          name: plan.name,
          price: new Prisma.Decimal(plan.price),
          tokensPerCycle: plan.tokensPerCycle,
          isActive: true,
        },
      })
    )
  );

  return db.vipPlan.findMany({
    where: {
      shopId,
      isActive: true,
    },
    orderBy: {
      price: "asc",
    },
  });
}

export async function getActiveVipSubscriptionForCustomer(
  db: VipDb,
  {
    shopId,
    customerId,
  }: {
    shopId: string;
    customerId: string;
  }
) {
  return db.vipSubscription.findFirst({
    where: {
      shopId,
      customerId,
      status: "ACTIVE",
    },
    include: {
      plan: true,
      payments: {
        orderBy: {
          cycleMonth: "desc",
        },
        take: 3,
      },
      usages: {
        orderBy: {
          usedAt: "desc",
        },
        take: 20,
      },
    },
  });
}

export async function hasPaidCurrentVipCycle(
  db: VipDb,
  subscriptionId: string,
  date = new Date()
) {
  const { cycleMonth } = getVipCycle(date);
  const payment = await db.vipPayment.findFirst({
    where: {
      subscriptionId,
      cycleMonth,
      status: "PAID",
    },
  });

  return Boolean(payment);
}

export function isVipPaymentPastDue(date = new Date(), dueDay = DEFAULT_VIP_DUE_DAY) {
  const dueDate = getVipPaymentDueDate(date, dueDay);

  return getCurrentScheduleDateValue(date) > getScheduleDateValue(dueDate);
}

export async function isCurrentVipCyclePaymentCovered(
  db: VipDb,
  subscriptionId: string,
  dueDay = DEFAULT_VIP_DUE_DAY,
  date = new Date()
) {
  const isPaid = await hasPaidCurrentVipCycle(db, subscriptionId, date);

  if (isPaid) {
    return true;
  }

  return !isVipPaymentPastDue(date, dueDay);
}

export function isCurrentVipCyclePaymentCoveredByRecords(
  payments: Array<{ cycleMonth: string; status: string }>,
  dueDay = DEFAULT_VIP_DUE_DAY,
  date = new Date()
) {
  const { cycleMonth } = getVipCycle(date);
  const isPaid = payments.some(
    (payment) => payment.cycleMonth === cycleMonth && payment.status === "PAID"
  );

  return isPaid || !isVipPaymentPastDue(date, dueDay);
}

export function getWeekRange(date: Date) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

export async function assertCanScheduleVipAppointment(
  db: VipDb,
  {
    shopId,
    customerId,
    appointmentDate,
    subscriptionId,
    excludeAppointmentId,
  }: {
    shopId: string;
    customerId: string;
    appointmentDate: Date;
    subscriptionId: string;
    excludeAppointmentId?: string;
  }
) {
  const { start, end } = getWeekRange(appointmentDate);
  const weeklyAppointment = await db.appointment.findFirst({
    where: {
      shopId,
      customerId,
      isVipPlanUse: true,
      vipSubscriptionId: subscriptionId,
      status: {
        in: ACTIVE_VIP_APPOINTMENT_STATUSES_FOR_WEEKLY_LIMIT,
      },
      id: excludeAppointmentId
        ? {
            not: excludeAppointmentId,
          }
        : undefined,
      date: {
        gte: start,
        lt: end,
      },
    },
    select: {
      id: true,
      date: true,
    },
  });

  if (weeklyAppointment) {
    throw new Error("Você já possui um atendimento do plano VIP nesta semana.");
  }
}

export function getVipPaymentDueDate(
  date = new Date(),
  dueDay = DEFAULT_VIP_DUE_DAY
) {
  return getVipDueDateForMonth(date, dueDay);
}

export async function consumeVipTokenForCompletedAppointment(
  db: VipDb,
  {
    appointment,
    createdById,
    serviceLabel,
  }: {
    appointment: {
      id: string;
      shopId: string;
      customerId: string;
      vipSubscriptionId: string | null;
      isVipPlanUse: boolean;
    };
    createdById?: string | null;
    serviceLabel: string;
  }
) {
  if (!appointment.isVipPlanUse || !appointment.vipSubscriptionId) {
    return null;
  }

  const existingUsage = await db.vipUsage.findUnique({
    where: {
      appointmentId: appointment.id,
    },
  });

  if (existingUsage) {
    return existingUsage;
  }

  const updatedSubscription = await db.vipSubscription.updateMany({
    where: {
      id: appointment.vipSubscriptionId,
      shopId: appointment.shopId,
      customerId: appointment.customerId,
      status: "ACTIVE",
      tokensRemaining: {
        gte: 1,
      },
    },
    data: {
      tokensRemaining: {
        decrement: 1,
      },
    },
  });

  if (updatedSubscription.count === 0) {
    throw new Error("Assinatura VIP sem token disponível para concluir este atendimento.");
  }

  return db.vipUsage.create({
    data: {
      shopId: appointment.shopId,
      subscriptionId: appointment.vipSubscriptionId,
      appointmentId: appointment.id,
      customerId: appointment.customerId,
      createdById: createdById || null,
      tokenAmount: 1,
      serviceLabel,
    },
  });
}
