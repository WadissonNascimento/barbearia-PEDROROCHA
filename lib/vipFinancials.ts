import { getVipCycle, isVipPaymentPastDue } from "@/lib/vip";
import { toMoneyNumber } from "@/lib/money";
import type { Prisma } from "@prisma/client";

type PrismaClientLike = Pick<Prisma.TransactionClient, "vipSubscription">;

export type VipMonthlyFinancialSummary = {
  cycleMonth: string;
  activeCount: number;
  paidCount: number;
  openCount: number;
  pendingCount: number;
  expectedRevenue: number;
  paidRevenue: number;
  openRevenue: number;
  pendingRevenue: number;
  planBreakdown: Array<{
    planId: string;
    planName: string;
    count: number;
    expectedRevenue: number;
    paidRevenue: number;
    openRevenue: number;
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
  let openCount = 0;
  let expectedRevenue = 0;
  let paidRevenue = 0;
  let openRevenue = 0;
  const hasPastDue = isVipPaymentPastDue(date);

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
        openRevenue: 0,
        pendingRevenue: 0,
      };

    planSummary.count += 1;
    planSummary.expectedRevenue += price;

    if (isPaid) {
      planSummary.paidRevenue += price;
    } else if (hasPastDue) {
      planSummary.pendingRevenue += price;
    } else {
      openCount += 1;
      openRevenue += price;
      planSummary.openRevenue += price;
    }

    planBreakdownMap.set(subscription.planId, planSummary);
  }

  const pendingCount = hasPastDue ? subscriptions.length - paidCount : 0;
  const pendingRevenue = hasPastDue ? expectedRevenue - paidRevenue : 0;

  return {
    cycleMonth,
    activeCount: subscriptions.length,
    paidCount,
    openCount,
    pendingCount,
    expectedRevenue,
    paidRevenue,
    openRevenue,
    pendingRevenue,
    planBreakdown: Array.from(planBreakdownMap.values()).sort(
      (a, b) => b.expectedRevenue - a.expectedRevenue
    ),
  };
}
