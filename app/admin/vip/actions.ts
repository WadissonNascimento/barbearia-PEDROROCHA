"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import {
  ensureVipPlansForShop,
  getVipCycle,
  getVipPaymentDueDate,
} from "@/lib/vip";

function getRequiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();

  if (!value) {
    throw new Error("Dados incompletos para atualizar o VIP.");
  }

  return value;
}

async function requireAdminShop() {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return shopId;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 2020 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("Informe uma data de vencimento valida.");
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export async function createVipSubscriptionAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const customerId = getRequiredString(formData, "customerId");
  const planId = getRequiredString(formData, "planId");
  const notes = String(formData.get("notes") || "").trim() || null;
  const now = new Date();
  const { start, end, cycleMonth } = getVipCycle(now);
  const dueDate = getVipPaymentDueDate(now);

  await ensureVipPlansForShop(prisma, shopId);

  await prisma.$transaction(async (tx) => {
    const [customer, plan] = await Promise.all([
      tx.user.findFirst({
        where: {
          id: customerId,
          shopId,
          role: "CUSTOMER",
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
      tx.vipPlan.findFirst({
        where: {
          id: planId,
          shopId,
          isActive: true,
        },
      }),
    ]);

    if (!customer || !plan) {
      throw new Error("Cliente ou plano VIP invalido.");
    }

    await tx.vipSubscription.updateMany({
      where: {
        shopId,
        customerId,
        status: "ACTIVE",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
      },
    });

    const subscription = await tx.vipSubscription.create({
      data: {
        shopId,
        customerId,
        planId: plan.id,
        status: "ACTIVE",
        tokensRemaining: plan.tokensPerCycle,
        cycleStart: start,
        cycleEnd: end,
        notes,
      },
    });

    await tx.vipPayment.create({
      data: {
        shopId,
        subscriptionId: subscription.id,
        cycleMonth,
        amount: plan.price,
        status: "PENDING",
        dueDate,
        notes: `Vence em ${dueDate.toLocaleDateString("pt-BR")}`,
      },
    });
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function markVipPaymentPaidAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const now = new Date();
  const { cycleMonth } = getVipCycle(now);

  const subscription = await prisma.vipSubscription.findFirst({
    where: {
      id: subscriptionId,
      shopId,
      status: "ACTIVE",
    },
    include: {
      plan: true,
    },
  });

  if (!subscription) {
    throw new Error("Assinatura VIP ativa nao encontrada.");
  }

  await prisma.vipPayment.upsert({
    where: {
      shopId_subscriptionId_cycleMonth: {
        shopId,
        subscriptionId: subscription.id,
        cycleMonth,
      },
    },
    update: {
      amount: subscription.plan.price,
      status: "PAID",
      paidAt: now,
    },
    create: {
      shopId,
      subscriptionId: subscription.id,
      cycleMonth,
      amount: subscription.plan.price,
      status: "PAID",
      dueDate: getVipPaymentDueDate(now),
      paidAt: now,
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function reopenVipPaymentAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const now = new Date();
  const { cycleMonth } = getVipCycle(now);

  await prisma.vipPayment.updateMany({
    where: {
      shopId,
      subscriptionId,
      cycleMonth,
      status: "PAID",
    },
    data: {
      status: "PENDING",
      paidAt: null,
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function renewVipCycleAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const now = new Date();
  const { start, end, cycleMonth } = getVipCycle(now);
  const dueDate = getVipPaymentDueDate(now);

  const subscription = await prisma.vipSubscription.findFirst({
    where: {
      id: subscriptionId,
      shopId,
      status: "ACTIVE",
    },
    include: {
      plan: true,
    },
  });

  if (!subscription) {
    throw new Error("Assinatura VIP ativa nao encontrada.");
  }

  await prisma.$transaction([
    prisma.vipSubscription.update({
      where: {
        id_shopId: {
          id: subscription.id,
          shopId,
        },
      },
      data: {
        tokensRemaining: subscription.plan.tokensPerCycle,
        cycleStart: start,
        cycleEnd: end,
      },
    }),
    prisma.vipPayment.upsert({
      where: {
        shopId_subscriptionId_cycleMonth: {
          shopId,
          subscriptionId: subscription.id,
          cycleMonth,
        },
      },
      update: {
        amount: subscription.plan.price,
        status: "PENDING",
        dueDate,
        paidAt: null,
      },
      create: {
        shopId,
        subscriptionId: subscription.id,
        cycleMonth,
        amount: subscription.plan.price,
        status: "PENDING",
        dueDate,
        notes: `Vence em ${dueDate.toLocaleDateString("pt-BR")}`,
      },
    }),
  ]);

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function cancelVipSubscriptionAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");

  await prisma.vipSubscription.updateMany({
    where: {
      id: subscriptionId,
      shopId,
      status: "ACTIVE",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      tokensRemaining: 0,
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function pauseVipSubscriptionAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");

  await prisma.vipSubscription.updateMany({
    where: {
      id: subscriptionId,
      shopId,
      status: "ACTIVE",
    },
    data: {
      status: "PAUSED",
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function updateVipPaymentDueDateAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const dueDateValue = getRequiredString(formData, "dueDate");
  const dueDate = parseDateInput(dueDateValue);
  const now = new Date();
  const { cycleMonth } = getVipCycle(now);

  const subscription = await prisma.vipSubscription.findFirst({
    where: {
      id: subscriptionId,
      shopId,
      status: "ACTIVE",
    },
    include: {
      plan: true,
    },
  });

  if (!subscription) {
    throw new Error("Assinatura VIP ativa nao encontrada.");
  }

  await prisma.vipPayment.upsert({
    where: {
      shopId_subscriptionId_cycleMonth: {
        shopId,
        subscriptionId: subscription.id,
        cycleMonth,
      },
    },
    update: {
      dueDate,
      amount: subscription.plan.price,
      notes: `Vence em ${dueDate.toLocaleDateString("pt-BR")}`,
    },
    create: {
      shopId,
      subscriptionId: subscription.id,
      cycleMonth,
      amount: subscription.plan.price,
      status: "PENDING",
      dueDate,
      notes: `Vence em ${dueDate.toLocaleDateString("pt-BR")}`,
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function adjustVipTokensAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const tokens = Number(formData.get("tokens"));

  if (!Number.isInteger(tokens) || tokens < 0 || tokens > 31) {
    throw new Error("Informe uma quantidade de tokens valida.");
  }

  await prisma.vipSubscription.updateMany({
    where: {
      id: subscriptionId,
      shopId,
      status: "ACTIVE",
    },
    data: {
      tokensRemaining: tokens,
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function changeVipPlanAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const planId = getRequiredString(formData, "planId");
  const plan = await prisma.vipPlan.findFirst({
    where: {
      id: planId,
      shopId,
      isActive: true,
    },
  });

  if (!plan) {
    throw new Error("Plano VIP invalido.");
  }

  await prisma.vipSubscription.updateMany({
    where: {
      id: subscriptionId,
      shopId,
      status: "ACTIVE",
    },
    data: {
      planId: plan.id,
      tokensRemaining: plan.tokensPerCycle,
    },
  });

  const { cycleMonth } = getVipCycle();
  await prisma.vipPayment.updateMany({
    where: {
      shopId,
      subscriptionId,
      cycleMonth,
      status: "PENDING",
    },
    data: {
      amount: new Prisma.Decimal(plan.price),
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}
