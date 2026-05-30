import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/lib/money";

type TipRange = {
  start: Date;
  end: Date;
};

export type BarberTipFinanceSummary = {
  barberId: string;
  tipsTotal: number;
  tipsCount: number;
};

export async function getBarberTipsTotal({
  barberId,
  range,
}: {
  barberId: string;
  range: TipRange;
}) {
  const result = await prisma.barberTip.aggregate({
    where: {
      barberId,
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      _all: true,
    },
  });

  return {
    tipsTotal: toMoneyNumber(result._sum.amount),
    tipsCount: result._count._all,
  };
}

export async function getBarberTipsByBarber(
  range: TipRange,
  shopId?: string | null
) {
  const groupedTips = await prisma.barberTip.groupBy({
    by: ["barberId"],
    where: {
      ...(shopId ? { shopId } : {}),
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      _all: true,
    },
  });

  return new Map<string, BarberTipFinanceSummary>(
    groupedTips.map((item) => [
      item.barberId,
      {
        barberId: item.barberId,
        tipsTotal: toMoneyNumber(item._sum.amount),
        tipsCount: item._count._all,
      },
    ])
  );
}

export async function getBarberTipRows({
  barberId,
  range,
}: {
  barberId: string;
  range: TipRange;
}) {
  const rows = await prisma.barberTip.findMany({
    where: {
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
  });

  return rows.map((row) => ({
    ...row,
    amount: toMoneyNumber(row.amount),
  }));
}
