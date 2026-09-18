"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import {
  getVipCycle,
  getVipPaymentDueDate,
  normalizeVipDueDay,
} from "@/lib/vip";
import {
  AsaasApiError,
  deleteAsaasVipSubscription,
  type VipAsaasBillingType,
  updateAsaasVipSubscription,
} from "@/lib/asaas";

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

export async function setVipEnrollmentOpenAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const isOpen = String(formData.get("isOpen")) === "true";

  await prisma.shop.update({
    where: { id: shopId },
    data: { vipEnrollmentOpen: isOpen },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
}

export async function createVipSubscriptionAction(_formData: FormData) {
  await requireAdminShop();
  throw new Error(
    "Por segurança, a ativação é feita pelo próprio cliente na área de planos, informando o cartão diretamente ao Asaas."
  );
}

export async function cancelVipSubscriptionAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");

  const subscription = await prisma.vipSubscription.findFirst({
    where: { id: subscriptionId, shopId, status: "ACTIVE" },
    select: { id: true, asaasSubscriptionId: true },
  });

  if (!subscription) throw new Error("Assinatura VIP ativa não encontrada.");
  if (subscription.asaasSubscriptionId) {
    try {
      await deleteAsaasVipSubscription(subscription.asaasSubscriptionId);
    } catch (error) {
      // An already removed provider subscription must not prevent the owner
      // from cancelling the local membership.
      if (!(error instanceof AsaasApiError && error.status === 404)) {
        throw error;
      }
    }
  }

  await prisma.vipSubscription.update({
    where: { id_shopId: { id: subscription.id, shopId } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      tokensRemaining: 0,
      asaasStatus: subscription.asaasSubscriptionId ? "DELETED" : "CANCELLED_MANUALLY",
      lastAsaasSyncAt: new Date(),
    },
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
    where: { id: subscriptionId, shopId, status: "ACTIVE" },
    include: { plan: true },
  });

  if (!subscription) throw new Error("Assinatura VIP ativa não encontrada.");

  await prisma.vipPayment.upsert({
    where: {
      shopId_subscriptionId_cycleMonth: { shopId, subscriptionId, cycleMonth },
    },
    create: {
      shopId,
      subscriptionId,
      cycleMonth,
      amount: subscription.plan.price,
      status: "PAID",
      paidAt: now,
      dueDate: getVipPaymentDueDate(now, subscription.dueDay),
      notes: "Pagamento confirmado manualmente pelo administrador.",
      asaasStatus: "PAID_MANUALLY",
    },
    update: {
      amount: subscription.plan.price,
      status: "PAID",
      paidAt: now,
      notes: "Pagamento confirmado manualmente pelo administrador.",
      asaasStatus: "PAID_MANUALLY",
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

  const subscription = await prisma.vipSubscription.findFirst({
    where: { id: subscriptionId, shopId, status: "ACTIVE" },
    include: { plan: true },
  });

  if (!subscription) throw new Error("Assinatura VIP ativa não encontrada.");

  await prisma.vipPayment.upsert({
    where: {
      shopId_subscriptionId_cycleMonth: { shopId, subscriptionId, cycleMonth },
    },
    create: {
      shopId,
      subscriptionId,
      cycleMonth,
      amount: subscription.plan.price,
      status: "PENDING",
      dueDate: getVipPaymentDueDate(now, subscription.dueDay),
      notes: "Mensalidade reaberta manualmente pelo administrador.",
      asaasStatus: "PENDING_MANUALLY",
    },
    update: {
      amount: subscription.plan.price,
      status: "PENDING",
      paidAt: null,
      notes: "Mensalidade reaberta manualmente pelo administrador.",
      asaasStatus: "PENDING_MANUALLY",
    },
  });

  revalidatePath("/admin/vip");
  revalidatePath("/planos");
  revalidatePath("/agendar");
}

export async function pauseVipSubscriptionAction(formData: FormData) {
  const shopId = await requireAdminShop();
  const subscriptionId = getRequiredString(formData, "subscriptionId");

  const subscription = await prisma.vipSubscription.findFirst({
    where: { id: subscriptionId, shopId, status: "ACTIVE" },
    select: { id: true, asaasSubscriptionId: true },
  });
  if (!subscription) throw new Error("Assinatura VIP ativa não encontrada.");
  if (!subscription.asaasSubscriptionId) {
    throw new Error("Esta assinatura ainda não está vinculada ao Asaas.");
  }

  await updateAsaasVipSubscription(subscription.asaasSubscriptionId, {
    status: "INACTIVE",
  });
  await prisma.vipSubscription.update({
    where: { id_shopId: { id: subscription.id, shopId } },
    data: { status: "PAUSED", asaasStatus: "INACTIVE", lastAsaasSyncAt: new Date() },
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
        asaasSubscriptionId: true,
        asaasBillingType: true,
        payments: {
          where: { cycleMonth },
          select: { status: true },
          take: 1,
        },
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

  const currentCyclePaid = subscription.payments[0]?.status === "PAID";
  const dueDate = getVipPaymentDueDate(
    currentCyclePaid ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now,
    dueDay
  );

  if (!subscription.asaasSubscriptionId || !subscription.asaasBillingType) {
    throw new Error("Esta assinatura ainda não está vinculada ao Asaas.");
  }

  await updateAsaasVipSubscription(subscription.asaasSubscriptionId, {
    billingType: subscription.asaasBillingType as VipAsaasBillingType,
    value: Number(plan.price),
    nextDueDate: dueDate,
    description: `Plano VIP ${plan.name}`,
    updatePendingPayments: true,
  });

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
        lastAsaasSyncAt: new Date(),
      },
    }),
    ...(!currentCyclePaid ? [prisma.vipPayment.upsert({
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
    })] : []),
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
