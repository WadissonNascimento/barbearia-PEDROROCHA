import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import { roundMoney, toMoneyNumber, type MoneyValue } from "@/lib/money";

type FinancialsPrismaClient = Pick<
  PrismaClient,
  "appointment" | "appointmentService" | "$transaction"
>;

export type FinancialServiceInput = {
  price: MoneyValue;
  commissionType?: string | null;
  commissionValue?: MoneyValue;
};

export function calculateCommissionFinancials(input: FinancialServiceInput) {
  const commissionType = input.commissionType === "FIXED" ? "FIXED" : "PERCENT";
  const commissionValue = Math.max(0, toMoneyNumber(input.commissionValue));
  const price = Math.max(0, toMoneyNumber(input.price));

  const barberPayout =
    commissionType === "FIXED"
      ? Math.min(price, commissionValue)
      : price * (commissionValue / 100);

  const normalizedPayout = roundMoney(barberPayout);
  const shopRevenue = roundMoney(price - normalizedPayout);

  return {
    commissionType,
    commissionValue,
    barberPayout: normalizedPayout,
    shopRevenue,
  };
}

export function calculateServiceFinancials(service: FinancialServiceInput) {
  return calculateCommissionFinancials(service);
}

export async function syncAppointmentFinancialSnapshots(
  appointmentId: string,
  db: FinancialsPrismaClient = prisma
) {
  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      services: {
        include: {
          service: true,
        },
      },
    },
  });

  if (!appointment) {
    throw new Error("Agendamento nao encontrado.");
  }

  await db.$transaction(
    appointment.services.map((item) => {
      const financials = calculateServiceFinancials({
        price: item.priceSnapshot,
        commissionType: item.commissionTypeSnapshot ?? item.service.commissionType,
        commissionValue: item.commissionValueSnapshot ?? item.service.commissionValue,
      });

      return db.appointmentService.update({
        where: { id: item.id },
        data: {
          commissionTypeSnapshot: financials.commissionType,
          commissionValueSnapshot: financials.commissionValue,
          barberPayoutSnapshot: financials.barberPayout,
          shopRevenueSnapshot: financials.shopRevenue,
        },
      });
    })
  );
}

export function getWeekRange(baseDate = new Date()) {
  const start = new Date(baseDate);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getMonthRange(baseDate = new Date()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
