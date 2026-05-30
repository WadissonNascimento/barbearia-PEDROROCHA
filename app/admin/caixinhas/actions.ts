"use server";

import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/lib/money";
import {
  createScheduleDayEnd,
  createScheduleDayStart,
  getCurrentScheduleDateValue,
  getScheduleDateValue,
} from "@/lib/scheduleTime";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

export type AdminTipPeriod = "today" | "week" | "month" | "custom";

export type AdminTipFilters = {
  period?: AdminTipPeriod;
  start?: string;
  end?: string;
};

export type AdminTipSummaryItem = {
  barberId: string;
  barberName: string;
  totalAmount: number;
  tipsCount: number;
  lastTip: {
    clientName: string;
    amount: number;
    createdAt: string;
  } | null;
};

export type AdminTipDetailItem = {
  id: string;
  clientName: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

export type AdminTipDetailsResult = {
  ok: boolean;
  message?: string;
  items: AdminTipDetailItem[];
  page: number;
  hasNextPage: boolean;
};

const DETAIL_PAGE_SIZE = 20;

async function requireAdmin() {
  const { user, shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return {
    userId: user.id,
    shopId,
  };
}

function parseDateValue(value?: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value! : null;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveAdminTipRange(filters: AdminTipFilters = {}) {
  const today = getCurrentScheduleDateValue();
  const todayStart = createScheduleDayStart(today)!;
  const todayEnd = createScheduleDayEnd(today)!;

  if (filters.period === "custom") {
    const startValue = parseDateValue(filters.start);
    const endValue = parseDateValue(filters.end);
    const start = startValue ? createScheduleDayStart(startValue) : todayStart;
    const end = endValue ? createScheduleDayEnd(endValue) : todayEnd;

    if (!start || !end || start > end) {
      return {
        period: "today" as const,
        start: todayStart,
        end: todayEnd,
        startValue: today,
        endValue: today,
      };
    }

    return {
      period: "custom" as const,
      start,
      end,
      startValue: getScheduleDateValue(start),
      endValue: getScheduleDateValue(end),
    };
  }

  if (filters.period === "month") {
    const monthStart = new Date(
      Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1)
    );
    const monthEnd = new Date(
      Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() + 1, 1) - 1
    );

    return {
      period: "month" as const,
      start: monthStart,
      end: monthEnd,
      startValue: getScheduleDateValue(monthStart),
      endValue: getScheduleDateValue(monthEnd),
    };
  }

  if (filters.period === "week") {
    const day = todayStart.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = addUtcDays(todayStart, diff);
    const weekEnd = new Date(addUtcDays(weekStart, 7).getTime() - 1);

    return {
      period: "week" as const,
      start: weekStart,
      end: weekEnd,
      startValue: getScheduleDateValue(weekStart),
      endValue: getScheduleDateValue(weekEnd),
    };
  }

  return {
    period: "today" as const,
    start: todayStart,
    end: todayEnd,
    startValue: today,
    endValue: today,
  };
}

export async function getAdminTipsSummaryAction(filters: AdminTipFilters = {}) {
  const admin = await requireAdmin();
  const range = resolveAdminTipRange(filters);
  const where = {
    shopId: admin.shopId,
    createdAt: {
      gte: range.start,
      lte: range.end,
    },
  };

  const [barbers, groupedTips, latestTips] = await Promise.all([
    prisma.user.findMany({
      where: {
        shopId: admin.shopId,
        role: "BARBER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.barberTip.groupBy({
      by: ["barberId"],
      where,
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.barberTip.findMany({
      where,
      distinct: ["barberId"],
      orderBy: [
        {
          barberId: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: {
        barberId: true,
        clientName: true,
        amount: true,
        createdAt: true,
      },
    }),
  ]);

  const totalsByBarber = new Map(groupedTips.map((item) => [item.barberId, item]));
  const latestByBarber = new Map(latestTips.map((item) => [item.barberId, item]));

  const summaries = barbers
    .map((barber) => {
      const totals = totalsByBarber.get(barber.id);
      const latest = latestByBarber.get(barber.id);

      return {
        barberId: barber.id,
        barberName: barber.name || "Barbeiro",
        totalAmount: toMoneyNumber(totals?._sum.amount),
        tipsCount: totals?._count._all || 0,
        lastTip: latest
          ? {
              clientName: latest.clientName,
              amount: toMoneyNumber(latest.amount),
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount || a.barberName.localeCompare(b.barberName));

  return {
    filters: {
      period: range.period,
      start: range.startValue,
      end: range.endValue,
    },
    summaries,
  };
}

export async function getAdminBarberTipsAction({
  barberId,
  filters = {},
  page = 1,
}: {
  barberId: string;
  filters?: AdminTipFilters;
  page?: number;
}): Promise<AdminTipDetailsResult> {
  const admin = await requireAdmin();
  const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1;
  const range = resolveAdminTipRange(filters);

  const barber = await prisma.user.findFirst({
    where: {
      id: barberId,
      shopId: admin.shopId,
      role: "BARBER",
    },
    select: {
      id: true,
    },
  });

  if (!barber) {
    return {
      ok: false,
      message: "Barbeiro nao encontrado.",
      items: [],
      page: safePage,
      hasNextPage: false,
    };
  }

  const rows = await prisma.barberTip.findMany({
    where: {
      shopId: admin.shopId,
      barberId,
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    },
    select: {
      id: true,
      clientName: true,
      amount: true,
      note: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (safePage - 1) * DETAIL_PAGE_SIZE,
    take: DETAIL_PAGE_SIZE + 1,
  });

  return {
    ok: true,
    items: rows.slice(0, DETAIL_PAGE_SIZE).map((item) => ({
      id: item.id,
      clientName: item.clientName,
      amount: toMoneyNumber(item.amount),
      note: item.note,
      createdAt: item.createdAt.toISOString(),
    })),
    page: safePage,
    hasNextPage: rows.length > DETAIL_PAGE_SIZE,
  };
}
