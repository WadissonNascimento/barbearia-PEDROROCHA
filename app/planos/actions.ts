"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { mutationError, mutationSuccess, type MutationResult } from "@/lib/mutationResult";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, getTenantSession } from "@/lib/tenantSession";
import { reconcileVipAsaasSubscriptions } from "@/lib/vipAsaasReconciliation";
import { createAsaasCustomer, createAsaasPayment, createAsaasVipSubscription, findAsaasCustomer, findAsaasPayment, findAsaasSubscription, getVipAsaasExternalReference, isAsaasVipBillingConfigured } from "@/lib/asaas";
import { getVipCycle, getVipPaymentDueDate } from "@/lib/vip";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import { resolveAsaasRecurringDueDate } from "@/lib/vipMigration";
import { parseVipCreditCard } from "@/lib/vipCard";

function normalizeCpfCnpj(value: string) {
  return value.replace(/\D/g, "");
}

function hasValidDocumentLength(value: string) {
  return (value.length === 11 || value.length === 14) && !/^(\d)\1+$/.test(value);
}

async function getCustomerIp() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export async function saveVipBillingProfileAction(
  _previousState: MutationResult,
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({ roles: CUSTOMER_ROLES });
  if (!tenantSession) return mutationError("Entre como cliente para completar os dados.");

  const cpfCnpj = normalizeCpfCnpj(String(formData.get("cpfCnpj") || ""));
  if (!hasValidDocumentLength(cpfCnpj)) {
    return mutationError("Informe um CPF ou CNPJ válido.");
  }

  const customer = await prisma.user.findFirst({
    where: { id: tenantSession.user.id, shopId: tenantSession.shopId, role: "CUSTOMER", isActive: true },
    select: { name: true, email: true, phone: true },
  });
  if (!customer) return mutationError("Cliente inválido.");

  let card;
  try {
    card = parseVipCreditCard(formData, { ...customer, cpfCnpj }, await getCustomerIp());
  } catch (error) {
    return mutationError(error instanceof Error ? error.message : "Dados do cartão inválidos.");
  }

  await prisma.customerProfile.upsert({
    where: { customerId: tenantSession.user.id },
    update: { cpfCnpj },
    create: {
      shopId: tenantSession.shopId,
      customerId: tenantSession.user.id,
      cpfCnpj,
    },
  });

  try {
    await prisma.vipSubscription.updateMany({where: {shopId: tenantSession.shopId, customerId: tenantSession.user.id, status: "ACTIVE", asaasSubscriptionId: null}, data: {asaasBillingType: "CREDIT_CARD"}});
    const result = await reconcileVipAsaasSubscriptions({
      shopId: tenantSession.shopId,
      customerId: tenantSession.user.id,
      card,
    });
    if (result.failed) return mutationError("Dados salvos. A cobrança ainda não foi vinculada. Tente novamente.");
  } catch (error) {
    console.error("[vip-asaas] Dados salvos, mas a sincronização inicial falhou", error);
    return mutationError("Dados salvos. A cobrança ainda não foi vinculada. Tente novamente.");
  }

  revalidatePath("/planos");
  revalidatePath("/admin/vip");
  return mutationSuccess("Cartão validado e cobrança automática ativada. Sua conta continuará sendo a mesma.");
}

export async function startVipSubscriptionAction(
  _previousState: MutationResult,
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({ roles: CUSTOMER_ROLES });
  if (!tenantSession) return mutationError("Entre na sua conta para assinar um plano.");
  if (!isAsaasVipBillingConfigured()) return mutationError("A cobrança automática ainda não foi configurada.");

  const code = String(formData.get("planCode") || "").trim();
  const billingType = "CREDIT_CARD" as const;

  const [customer, plan, activeSubscription, shop] = await Promise.all([
    prisma.user.findFirst({
      where: { id: tenantSession.user.id, shopId: tenantSession.shopId, role: "CUSTOMER", isActive: true },
      include: { customerProfile: { select: { cpfCnpj: true } } },
    }),
    prisma.vipPlan.findFirst({ where: { shopId: tenantSession.shopId, code, isActive: true } }),
    prisma.vipSubscription.findFirst({ where: { shopId: tenantSession.shopId, customerId: tenantSession.user.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.shop.findUnique({ where: { id: tenantSession.shopId }, select: { vipEnrollmentOpen: true } }),
  ]);

  if (!customer || !plan) return mutationError("Plano ou cliente inválido.");
  if (!shop?.vipEnrollmentOpen) return mutationError("As inscrições para os planos estão fechadas no momento.");
  if (activeSubscription) return mutationError("Você já possui uma assinatura VIP ativa.");
  const cpfCnpj = normalizeCpfCnpj(String(formData.get("cpfCnpj") || customer.customerProfile?.cpfCnpj || ""));
  if (!hasValidDocumentLength(cpfCnpj)) return mutationError("Informe um CPF ou CNPJ válido.");
  await prisma.customerProfile.upsert({
    where: { customerId: customer.id },
    update: { cpfCnpj },
    create: { shopId: tenantSession.shopId, customerId: customer.id, cpfCnpj },
  });

  let card;
  try {
    card = parseVipCreditCard(
      formData,
      { ...customer, cpfCnpj },
      await getCustomerIp()
    );
  } catch (error) {
    return mutationError(error instanceof Error ? error.message : "Dados do cartão inválidos.");
  }

  const now = new Date();
  const { start, end, cycleMonth } = getVipCycle(now);
  const dueDate = getVipPaymentDueDate(now);
  let localSubscription;
  try {
    localSubscription = await prisma.vipSubscription.create({
      data: {
        shopId: tenantSession.shopId,
        customerId: customer.id,
        planId: plan.id,
        status: "SETUP",
        tokensRemaining: plan.tokensPerCycle,
        dueDay: 5,
        cycleStart: start,
        cycleEnd: end,
        asaasBillingType: billingType,
        asaasStatus: "CREATING",
        asaasFirstDueDate: dueDate,
      },
    });
  } catch (error) {
    console.error("[vip-asaas] Falha ao reservar assinatura", error);
    return mutationError("Já existe uma ativação em andamento. Atualize a página e tente novamente.");
  }

  try {
    const customerReference = `vip-customer:${tenantSession.shopId}:${customer.id}`;
    const asaasCustomer = await findAsaasCustomer(customerReference) || await createAsaasCustomer({
      name: customer.name || customer.email || "Cliente VIP",
      email: customer.email,
      phone: customer.phone,
      cpfCnpj,
      externalReference: customerReference,
    });
    const subscriptionReference = getVipAsaasExternalReference(tenantSession.shopId, localSubscription.id);
    const today = getCurrentScheduleDateValue();
    const recurringDueDate = resolveAsaasRecurringDueDate(dueDate, 5, today);
    const asaasSubscription = await findAsaasSubscription(subscriptionReference) || await createAsaasVipSubscription({
      customerId: asaasCustomer.id,
      billingType,
      value: Number(plan.price),
      nextDueDate: recurringDueDate,
      description: `Plano VIP ${plan.name}`,
      externalReference: subscriptionReference,
      card,
    });
    const overdueReference = `vip-payment:${tenantSession.shopId}:${localSubscription.id}:${cycleMonth}`;
    const overduePayment = dueDate.toISOString().slice(0, 10) < today
      ? await findAsaasPayment(overdueReference) || await createAsaasPayment({
          customerId: asaasCustomer.id,
          billingType,
          value: Number(plan.price),
          dueDate: new Date(`${today}T12:00:00.000Z`),
          description: `Plano VIP ${plan.name} - competência ${cycleMonth}`,
          externalReference: overdueReference,
          card,
        })
      : null;
    await prisma.$transaction([
      prisma.vipSubscription.update({
        where: { id: localSubscription.id },
        data: { status: "ACTIVE", asaasCustomerId: asaasCustomer.id, asaasSubscriptionId: asaasSubscription.id, asaasStatus: asaasSubscription.status, lastAsaasSyncAt: new Date() },
      }),
      prisma.vipPayment.create({
        data: {
          shopId: tenantSession.shopId,
          subscriptionId: localSubscription.id,
          cycleMonth,
          amount: plan.price,
          status: "PENDING",
          dueDate,
          asaasPaymentId: overduePayment?.id,
          asaasStatus: overduePayment?.status,
          invoiceUrl: overduePayment?.invoiceUrl,
          bankSlipUrl: overduePayment?.bankSlipUrl,
          externalReference: overduePayment ? overdueReference : null,
          notes: "Cobrança criada automaticamente no Asaas.",
        },
      }),
    ]);
  } catch (error) {
    await prisma.vipSubscription.update({ where: { id: localSubscription.id }, data: { status: "SETUP_FAILED", asaasStatus: "ERROR" } });
    console.error("[vip-asaas] Falha ao iniciar assinatura", error);
    return mutationError("Não foi possível iniciar a cobrança. Tente novamente mais tarde.");
  }

  revalidatePath("/planos");
  revalidatePath("/agendar");
  revalidatePath("/admin/vip");
  return mutationSuccess("Assinatura criada. Acompanhe o pagamento na sua área VIP.");
}
