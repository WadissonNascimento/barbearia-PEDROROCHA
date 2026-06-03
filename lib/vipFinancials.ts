import { getVipCycle } from "@/lib/vip";
import { toMoneyNumber } from "@/lib/money";
import type { Prisma } from "@prisma/client";

type PrismaClientLike = Pick<Prisma.TransactionClient, "vipSubscription">;

export type VipMonthlyFinancialSummary = {
  cycleMonth: string;
  activeCount: number;
  paidCount: number;
  pendingCount: number;
  expectedRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  planBreakdown: Array<{
    planId: string;
    planName: string;
    count: number;
    expectedRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
  }>;
};

export async function getVipMonthlyFinancialSummary(
  db: PrismaClientLike,
  shopId: string,
  date = new Date()
): Promise<VipMonthlyFinancialSummary> {
  const { cycleMonth } = getVipCycle(date);
  const subscriptions = await db.vipSubscription.findMany({
    where: {
      shopId,
      status: "ACTIVE",
    },
    select: {
      planId: true,
      plan: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
      payments: {
        where: {
          cycleMonth,
        },
        select: {
          status: true,
        },
        take: 1,
      },
    },
  });
  const planBreakdownMap = new Map<
    string,
    VipMonthlyFinancialSummary["planBreakdown"][number]
  >();

  let paidCount = 0;
  let expectedRevenue = 0;
  let paidRevenue = 0;

  for (const subscription of subscriptions) {
    const price = toMoneyNumber(subscription.plan.price);
    const isPaid = subscription.payments[0]?.status === "PAID";

    expectedRevenue += price;

    if (isPaid) {
      paidCount += 1;
      paidRevenue += price;
    }

    const planSummary =
      planBreakdownMap.get(subscription.planId) ||
      {
        planId: subscription.plan.id,
        planName: subscription.plan.name,
        count: 0,
        expectedRevenue: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
      };

    planSummary.count += 1;
    planSummary.expectedRevenue += price;

    if (isPaid) {
      planSummary.paidRevenue += price;
    } else {
      planSummary.pendingRevenue += price;
    }

    planBreakdownMap.set(subscription.planId, planSummary);
  }

  const pendingCount = subscriptions.length - paidCount;
  const pendingRevenue = expectedRevenue - paidRevenue;

  return {
    cycleMonth,
    activeCount: subscriptions.length,
    paidCount,
    pendingCount,
    expectedRevenue,
    paidRevenue,
    pendingRevenue,
    planBreakdown: Array.from(planBreakdownMap.values()).sort(
      (a, b) => b.expectedRevenue - a.expectedRevenue
    ),
  };
}
