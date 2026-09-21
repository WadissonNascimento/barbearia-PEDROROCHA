"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { mutationError, mutationSuccess, type MutationResult } from "@/lib/mutationResult";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, getTenantSession } from "@/lib/tenantSession";
import { reconcileVipAsaasSubscriptions } from "@/lib/vipAsaasReconciliation";
import { createAsaasCustomer, createAsaasPayment, createAsaasVipSubscription, findAsaasCustomer, findAsaasPayment, findAsaasSubscription, getVipAsaasExternalReference, isAsaasVipBillingConfigured, updateAsaasCustomer } from "@/lib/asaas";
import { getVipCycle, getVipPaymentDueDate } from "@/lib/vip";
import { getCurrentScheduleDateValue } from "@/lib/scheduleTime";
import { resolveAsaasRecurringDueDate } from "@/lib/vipMigration";
import { getVipAsaasPayerName, parseVipCreditCard } from "@/lib/vipCard";
import { parseVipBillingType } from "@/lib/vipBillingPolicy";
import { updateVipAsaasPreferences } from "@/lib/vipAsaasPreferences";
import { getVipBillingErrorMessage } from "@/lib/vipBillingErrors";

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
  if (!isAsaasVipBillingConfigured()) return mutationError("O pagamento dos planos ainda não está disponível. Tente novamente mais tarde.");

  const cpfCnpj = normalizeCpfCnpj(String(formData.get("cpfCnpj") || ""));
  if (!hasValidDocumentLength(cpfCnpj)) {
    return mutationError("Informe um CPF ou CNPJ válido.");
  }

  const customer = await prisma.user.findFirst({
    where: { id: tenantSession.user.id, shopId: tenantSession.shopId, role: "CUSTOMER", isActive: true },
    select: { name: true, email: true, phone: true },
  });
  if (!customer) return mutationError("Cliente inválido.");

  const subscription = await prisma.vipSubscription.findFirst({
    where: { shopId: tenantSession.shopId, customerId: tenantSession.user.id, status: "ACTIVE" },
    include: { payments: { where: { status: { not: "PAID" }, asaasPaymentId: { not: null } } } },
  });
  if (!subscription) return mutationError("Você não possui uma assinatura ativa para atualizar.");

  let card;
  let billingType;
  let verifiedProviderPayments: Awaited<ReturnType<typeof updateVipAsaasPreferences>>["payments"] = [];
  try {
    billingType = parseVipBillingType(formData.get("billingType"));
    if (billingType === "CREDIT_CARD") {
      card = parseVipCreditCard(formData, { ...customer, cpfCnpj }, await getCustomerIp());
    }
  } catch (error) {
    return mutationError(error instanceof Error ? error.message : "Dados do cartão inválidos.");
  }

  const lease = new Date();
  const claimed = await prisma.vipSubscription.updateMany({
    where: {
      id: subscription.id, shopId: tenantSession.shopId, status: "ACTIVE",
      OR: [{ billingUpdateStartedAt: null }, { billingUpdateStartedAt: { lt: new Date(lease.getTime() - 10 * 60_000) } }],
    },
    data: { billingUpdateStartedAt: lease, billingProfileConfirmedAt: null },
  });
  if (!claimed.count) return mutationError("Seus dados estão sendo atualizados. Aguarde alguns instantes e tente novamente.");

  try {
    if (subscription.asaasCustomerId) {
      await updateAsaasCustomer(subscription.asaasCustomerId, {
        cpfCnpj, name: getVipAsaasPayerName(customer, card), email: customer.email || undefined,
        mobilePhone: customer.phone?.replace(/\D/g, "") || undefined,
      });
    }
    if (subscription.asaasSubscriptionId) {
      const preference = await updateVipAsaasPreferences({
        subscriptionId: subscription.asaasSubscriptionId, billingType, card,
        standalonePaymentIds: subscription.payments.filter(payment => payment.externalReference?.startsWith("vip-payment:")).map(payment => payment.asaasPaymentId!),
      });
      verifiedProviderPayments = preference.payments;
    }
    await prisma.customerProfile.upsert({
      where: { customerId: tenantSession.user.id },
      update: { cpfCnpj },
      create: { shopId: tenantSession.shopId, customerId: tenantSession.user.id, cpfCnpj },
    });
    await prisma.vipSubscription.update({ where: { id: subscription.id }, data: { asaasBillingType: billingType } });
    for (const providerPayment of verifiedProviderPayments) {
      await prisma.vipPayment.updateMany({
        where: { subscriptionId: subscription.id, asaasPaymentId: providerPayment.id },
        data: {
          asaasStatus: providerPayment.status,
          invoiceUrl: providerPayment.invoiceUrl || null,
          bankSlipUrl: providerPayment.bankSlipUrl || null,
          lastAsaasEventAt: new Date(),
        },
      });
    }
    const result = await reconcileVipAsaasSubscriptions({
      shopId: tenantSession.shopId,
      customerId: tenantSession.user.id,
      card,
      billingUpdateLease: lease,
      skipStandaloneCreation: Boolean(subscription.asaasSubscriptionId && subscription.billingProfileConfirmedAt),
    });
    if ((result.failed || result.skipped || !result.configured) && !subscription.asaasSubscriptionId) return mutationError(result.errors[0] || "A atualização ainda não foi concluída. Tente novamente; as mensalidades já pagas serão preservadas.");
    const updated = await prisma.vipSubscription.findUnique({ where: { id: subscription.id }, select: { asaasSubscriptionId: true } });
    if (!updated?.asaasSubscriptionId) return mutationError("Não foi possível concluir a vinculação do pagamento. Tente novamente.");
    await prisma.vipSubscription.update({ where: { id: subscription.id }, data: { billingProfileConfirmedAt: new Date() } });
  } catch (error) {
    console.error("[vip-asaas] Falha ao atualizar preferências de pagamento", error instanceof Error ? error.name : "UnknownError");
    return mutationError(getVipBillingErrorMessage(error));
  } finally {
    await prisma.vipSubscription.updateMany({ where: { id: subscription.id, billingUpdateStartedAt: lease }, data: { billingUpdateStartedAt: null } });
    revalidatePath("/", "layout");
  }

  revalidatePath("/planos");
  revalidatePath("/admin/vip");
  return mutationSuccess(billingType === "CREDIT_CARD"
    ? "Dados e cartão atualizados. As próximas mensalidades serão cobradas no vencimento; meses pagos continuam quitados."
    : `Dados atualizados. Suas cobranças por ${billingType === "PIX" ? "Pix" : "boleto"} estarão disponíveis aqui para pagamento até o vencimento.`);
}

export async function startVipSubscriptionAction(
  _previousState: MutationResult,
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({ roles: CUSTOMER_ROLES });
  if (!tenantSession) return mutationError("Entre na sua conta para assinar um plano.");
  if (!isAsaasVipBillingConfigured()) return mutationError("A cobrança automática ainda não foi configurada.");

  const code = String(formData.get("planCode") || "").trim();
  let billingType;
  try { billingType = parseVipBillingType(formData.get("billingType")); }
  catch { return mutationError("Escolha como deseja pagar: boleto ou cartão de crédito."); }

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
    card = billingType === "CREDIT_CARD" ? parseVipCreditCard(
      formData,
      { ...customer, cpfCnpj },
      await getCustomerIp()
    ) : undefined;
  } catch (error) {
    return mutationError(error instanceof Error ? error.message : "Dados do cartão inválidos.");
  }

  const now = new Date();
  const { start, end } = getVipCycle(now);
  let dueDate = getVipPaymentDueDate(now);
  let localSubscription;
  try {
    const previousSetup = await prisma.vipSubscription.findFirst({
      where: { shopId: tenantSession.shopId, customerId: customer.id, status: { in: ["SETUP", "SETUP_FAILED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (previousSetup) {
      if (previousSetup.planId !== plan.id) return mutationError("Existe uma ativação pendente de outro plano. Conclua esse plano ou fale com a barbearia.");
      const recovered = await prisma.vipSubscription.updateMany({
        where: { id: previousSetup.id, OR: [{ status: "SETUP_FAILED" }, { status: "SETUP", billingUpdateStartedAt: { lt: new Date(now.getTime() - 10 * 60_000) } }] },
        data: { status: "SETUP", billingUpdateStartedAt: now, asaasBillingType: billingType },
      });
      if (!recovered.count) return mutationError("Sua assinatura está sendo ativada. Aguarde alguns instantes antes de tentar novamente.");
      localSubscription = previousSetup;
      dueDate = previousSetup.asaasFirstDueDate || dueDate;
    } else {
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
        billingUpdateStartedAt: now,
      },
      });
    }
  } catch (error) {
    console.error("[vip-asaas] Falha ao reservar assinatura", error instanceof Error ? error.name : "UnknownError");
    return mutationError("Já existe uma ativação em andamento. Atualize a página e tente novamente.");
  }

  try {
    const cycleMonth = dueDate.toISOString().slice(0, 7);
    const customerReference = `vip-customer:${tenantSession.shopId}:${customer.id}`;
    const asaasCustomer = await findAsaasCustomer(customerReference) || await createAsaasCustomer({
      name: getVipAsaasPayerName(customer, card),
      email: customer.email,
      phone: customer.phone,
      cpfCnpj,
      externalReference: customerReference,
    });
    await updateAsaasCustomer(asaasCustomer.id, {
      cpfCnpj,
      name: getVipAsaasPayerName(customer, card),
      email: customer.email || undefined,
      mobilePhone: customer.phone?.replace(/\D/g, "") || undefined,
    });
    await prisma.vipSubscription.update({ where: { id: localSubscription.id }, data: { asaasCustomerId: asaasCustomer.id } });
    const subscriptionReference = getVipAsaasExternalReference(tenantSession.shopId, localSubscription.id);
    const today = getCurrentScheduleDateValue();
    const recurringDueDate = resolveAsaasRecurringDueDate(dueDate, 5, today);
    const recoveredSubscription = await findAsaasSubscription(subscriptionReference);
    const asaasSubscription = recoveredSubscription || await createAsaasVipSubscription({
      customerId: asaasCustomer.id,
      billingType,
      value: Number(plan.price),
      nextDueDate: recurringDueDate,
      description: `Plano VIP ${plan.name}`,
      externalReference: subscriptionReference,
      card,
    });
    await prisma.vipSubscription.update({ where: { id: localSubscription.id }, data: { asaasSubscriptionId: asaasSubscription.id } });
    if (recoveredSubscription) {
      await updateVipAsaasPreferences({ subscriptionId: recoveredSubscription.id, billingType, card, standalonePaymentIds: [] });
    }
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
        data: { status: "ACTIVE", asaasCustomerId: asaasCustomer.id, asaasSubscriptionId: asaasSubscription.id, asaasStatus: asaasSubscription.status, lastAsaasSyncAt: new Date(), billingProfileConfirmedAt: new Date(), billingUpdateStartedAt: null },
      }),
      prisma.vipPayment.upsert({
        where: { shopId_subscriptionId_cycleMonth: { shopId: tenantSession.shopId, subscriptionId: localSubscription.id, cycleMonth } },
        update: {},
        create: {
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
    await prisma.vipSubscription.update({ where: { id: localSubscription.id }, data: { status: "SETUP_FAILED", asaasStatus: "ERROR", billingUpdateStartedAt: null } });
    console.error("[vip-asaas] Falha ao iniciar assinatura", error instanceof Error ? error.name : "UnknownError");
    return mutationError(getVipBillingErrorMessage(error));
  }

  revalidatePath("/planos");
  revalidatePath("/agendar");
  revalidatePath("/admin/vip");
  return mutationSuccess("Assinatura criada. Acompanhe o pagamento na sua área VIP.");
}
