"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import {
  DEFAULT_VIP_DUE_DAY,
  ensureVipPlansForShop,
  getVipCycle,
  getVipPaymentDueDate,
  normalizeVipDueDay,
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

export async function createVipSubscriptionAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const customerId = getRequiredString(formData, "customerId");
  const planId = getRequiredString(formData, "planId");
  const notes = String(formData.get("notes") || "").trim() || null;
  const now = new Date();
  const { start, end, cycleMonth } = getVipCycle(now);
  const dueDay = DEFAULT_VIP_DUE_DAY;
  const dueDate = getVipPaymentDueDate(now, dueDay);

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
      throw new Error("Cliente ou plano VIP inválido.");
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
        dueDay,
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
        notes: `Vence todo dia ${dueDay}`,
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
    throw new Error("Assinatura VIP ativa não encontrada.");
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
      dueDate: getVipPaymentDueDate(now, subscription.dueDay),
      paidAt: now,
    },
    create: {
      shopId,
      subscriptionId: subscription.id,
      cycleMonth,
      amount: subscription.plan.price,
      status: "PAID",
      dueDate: getVipPaymentDueDate(now, subscription.dueDay),
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
    throw new Error("Assinatura VIP ativa não encontrada.");
  }

  const dueDate = getVipPaymentDueDate(now, subscription.dueDay);

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
        notes: `Vence todo dia ${subscription.dueDay}`,
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

export async function updateVipSubscriptionSettingsAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const planId = getRequiredString(formData, "planId");
  const dueDay = normalizeVipDueDay(formData.get("dueDay"));
  const now = new Date();
  const { cycleMonth } = getVipCycle(now);

  const [subscription, plan] = await Promise.all([
    prisma.vipSubscription.findFirst({
      where: {
        id: subscriptionId,
        shopId,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    }),
    prisma.vipPlan.findFirst({
      where: {
        id: planId,
        shopId,
        isActive: true,
      },
    }),
  ]);

  if (!subscription || !plan) {
    throw new Error("Assinatura ou plano VIP inválido.");
  }

  const dueDate = getVipPaymentDueDate(now, dueDay);

  await prisma.$transaction([
    prisma.vipSubscription.update({
      where: {
        id_shopId: {
          id: subscription.id,
          shopId,
        },
      },
      data: {
        planId: plan.id,
        dueDay,
        tokensRemaining: plan.tokensPerCycle,
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
        dueDate,
        amount: plan.price,
        notes: `Vence todo dia ${dueDay}`,
      },
      create: {
        shopId,
        subscriptionId: subscription.id,
        cycleMonth,
        amount: plan.price,
        status: "PENDING",
        dueDate,
        notes: `Vence todo dia ${dueDay}`,
      },
    }),
  ]);

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function adjustVipTokensAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");
  const tokens = Number(formData.get("tokens"));

  if (!Number.isInteger(tokens) || tokens < 0 || tokens > 31) {
    throw new Error("Informe uma quantidade de tokens válida.");
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

