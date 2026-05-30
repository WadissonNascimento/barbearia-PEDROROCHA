"use server";

import { revalidatePath } from "next/cache";
import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { prisma } from "@/lib/prisma";
import {
  AppointmentMutationError,
  editCompletedAppointmentFinancialItems,
} from "@/lib/appointmentMutations";
import {
  getBarberPayoutSnapshot,
  getFinanceDashboardData,
  resolveFinanceRange,
} from "@/lib/financeReports";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

async function requireAdmin() {
  const { user } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return user;
}

function parseSelectedExtras(formData: FormData) {
  return formData
    .getAll("extraProductIds")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((extraProductId) => ({ extraProductId, quantity: 1 }));
}

export async function generateBarberPayoutsAction(
  formData: FormData
): Promise<MutationResult> {
  const admin = await requireAdmin();

  if (!admin.shopId) {
    return mutationError("Admin sem barbearia vinculada.");
  }

  const range = resolveFinanceRange({
    period: String(formData.get("period") || "week") as "week" | "month" | "custom",
    start: String(formData.get("start") || ""),
    end: String(formData.get("end") || ""),
  });

  const dashboard = await getFinanceDashboardData({
    shopId: admin.shopId,
    period: range.period,
    start: range.start.toISOString().slice(0, 10),
    end: range.end.toISOString().slice(0, 10),
    compareMode: String(formData.get("compareMode") || "auto") as "auto" | "custom",
    compareStart: String(formData.get("compareStart") || ""),
    compareEnd: String(formData.get("compareEnd") || ""),
  });

  const writablePayouts = dashboard.barberPayouts.filter(
    (item) => item.savedStatus !== "CLOSED" && item.savedStatus !== "PAID"
  );

  await prisma.$transaction(
    writablePayouts.map((item) =>
      prisma.barberPayout.upsert({
        where: {
          barberId_periodStart_periodEnd: {
            barberId: item.barberId,
            periodStart: range.start,
            periodEnd: range.end,
          },
        },
        update: {
          grossRevenue: item.grossRevenue,
          commissionTotal: item.commissionTotal,
          shopNetRevenue: item.shopNetRevenue,
          status: item.savedStatus === "PAID" ? "PAID" : "CLOSED",
        },
        create: {
          shopId: admin.shopId || undefined,
          barberId: item.barberId,
          periodStart: range.start,
          periodEnd: range.end,
          grossRevenue: item.grossRevenue,
          commissionTotal: item.commissionTotal,
          shopNetRevenue: item.shopNetRevenue,
          status: "CLOSED",
        },
      })
    )
  );

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return mutationSuccess("Repasses salvos com sucesso.");
}

export async function editCompletedAdminFinanceAppointmentAction(
  formData: FormData
): Promise<MutationResult> {
  const admin = await requireAdmin();
  const appointmentId = String(formData.get("appointmentId") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const serviceIds = formData
    .getAll("serviceIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const extras = parseSelectedExtras(formData);

  if (!admin.shopId) {
    return mutationError("Admin sem barbearia vinculada.");
  }

  if (
    !appointmentId ||
    serviceIds.length === 0 ||
    serviceIds.length > 8 ||
    extras.length > 12 ||
    notes.length > 400
  ) {
    return mutationError("Selecione servicos, extras e observacoes corretamente.");
  }

  try {
    const updatedAppointment = await editCompletedAppointmentFinancialItems({
      appointmentId,
      actor: "ADMIN",
      shopId: admin.shopId,
      serviceIds,
      extras,
      notes,
    });

    revalidatePath(`/admin/barbeiros/${updatedAppointment.barberId}/repasse-hoje`);
    revalidatePath(`/admin/barbeiros/${updatedAppointment.barberId}/repasse-semana`);
  } catch (error) {
    if (error instanceof AppointmentMutationError) {
      return mutationError(error.message);
    }

    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/agenda");
  revalidatePath("/barber");
  revalidatePath("/barber/financeiro");

  return mutationSuccess("Atendimento atualizado no financeiro.");
}

export async function markBarberPayoutAsPaidAction(
  formData: FormData
): Promise<MutationResult> {
  await requireAdmin();

  const payoutId = String(formData.get("payoutId") || "");

  if (!payoutId) {
    return mutationError("Repasse invalido.");
  }

  await prisma.barberPayout.update({
    where: { id: payoutId },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return mutationSuccess("Repasse marcado como pago.");
}

export async function reopenBarberPayoutAction(
  formData: FormData
): Promise<MutationResult> {
  await requireAdmin();

  const payoutId = String(formData.get("payoutId") || "");

  if (!payoutId) {
    return mutationError("Repasse invalido.");
  }

  await prisma.barberPayout.update({
    where: { id: payoutId },
    data: {
      status: "OPEN",
      paidAt: null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return mutationSuccess("Repasse aberto para revisao.", undefined, "info");
}

export async function closeBarberPayoutAction(
  formData: FormData
): Promise<MutationResult> {
  await requireAdmin();

  const payoutId = String(formData.get("payoutId") || "");

  if (!payoutId) {
    return mutationError("Repasse invalido.");
  }

  const payout = await prisma.barberPayout.findUnique({
    where: { id: payoutId },
  });

  if (!payout) {
    return mutationError("Repasse nao encontrado.");
  }

  if (payout.status !== "OPEN") {
    return mutationError("Reabra o repasse antes de recalcular valores.");
  }

  const snapshot = await getBarberPayoutSnapshot({
    barberId: payout.barberId,
    periodStart: payout.periodStart,
    periodEnd: payout.periodEnd,
  });

  await prisma.barberPayout.update({
    where: { id: payoutId },
    data: {
      grossRevenue: snapshot.grossRevenue,
      commissionTotal: snapshot.commissionTotal,
      shopNetRevenue: snapshot.shopNetRevenue,
      status: "CLOSED",
      paidAt: null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return mutationSuccess("Valores conferidos e repasse fechado.");
}

export async function deleteBarberPayoutAction(
  formData: FormData
): Promise<MutationResult> {
  await requireAdmin();

  const payoutId = String(formData.get("payoutId") || "");

  if (!payoutId) {
    return mutationError("Repasse invalido.");
  }

  const payout = await prisma.barberPayout.findUnique({
    where: { id: payoutId },
    select: { id: true },
  });

  if (!payout) {
    return mutationError("Repasse nao encontrado.");
  }

  await prisma.barberPayout.delete({
    where: { id: payoutId },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  return mutationSuccess("Repasse excluido com sucesso.");
}
