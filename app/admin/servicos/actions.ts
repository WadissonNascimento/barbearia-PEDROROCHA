"use server";

import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const { user } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return user;
}

function revalidateServiceViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/servicos");
  revalidatePath("/agendar");
  revalidatePath("/servicos");
  revalidatePath("/barber");
  revalidatePath("/barber/servicos");
}

export async function createAdminServiceAction(
  formData: FormData
): Promise<MutationResult> {
  const admin = await requireAdmin();

  const serviceKind = String(formData.get("serviceKind") || "SERVICE");
  if (serviceKind !== "SERVICE" && serviceKind !== "COMBO") {
    return mutationError("Escolha entre serviço e combo.");
  }
  const isCombo = serviceKind === "COMBO";
  const serviceScope = String(formData.get("serviceScope") || "GLOBAL");
  const barberIdRaw = String(formData.get("barberId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Number(formData.get("price") || 0);
  const duration = Number(formData.get("duration") || 0);
  const commissionValue = Number(formData.get("commissionValue") || 0);

  if (!name || price <= 0 || duration <= 0 || commissionValue < 0 || commissionValue > 100) {
    return mutationError("Preencha nome, preço, duração e comissão corretamente.");
  }

  const isExclusive = serviceScope === "EXCLUSIVE";
  let barberId: string | null = null;

  if (isExclusive) {
    if (!barberIdRaw) {
      return mutationError("Escolha o barbeiro que vai atender esse serviço exclusivo.");
    }

    const barber = await prisma.user.findFirst({
      where: {
        id: barberIdRaw,
        role: "BARBER",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!barber) {
      return mutationError("Barbeiro inválido para esse serviço exclusivo.");
    }

    barberId = barber.id;
  }

  await prisma.service.create({
    data: {
      shopId: admin.shopId || undefined,
      barberId,
      name,
      description: isCombo ? `Combo.${description ? ` ${description}` : ""}` : description || null,
      price,
      duration,
      commissionType: "PERCENT",
      commissionValue,
      isActive: true,
    },
  });

  revalidateServiceViews();
  return mutationSuccess(
    isCombo
      ? "Combo criado com sucesso."
      : isExclusive
      ? "Serviço exclusivo criado com sucesso."
      : "Serviço geral criado com sucesso."
  );
}

export async function updateGlobalServiceAction(
  formData: FormData
): Promise<MutationResult> {
  await requireAdmin();

  const serviceId = String(formData.get("serviceId") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Number(formData.get("price") || 0);
  const duration = Number(formData.get("duration") || 0);
  const commissionValue = Number(formData.get("commissionValue") || 0);

  if (
    !serviceId ||
    !name ||
    price <= 0 ||
    duration <= 0 ||
    commissionValue < 0 ||
    commissionValue > 100
  ) {
    return mutationError("Preencha nome, preço, duração e comissão corretamente.");
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    return mutationError("Serviço não encontrado.");
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      name,
      description: description || null,
      price,
      duration,
      commissionType: "PERCENT",
      commissionValue,
    },
  });

  revalidateServiceViews();
  return mutationSuccess("Serviço atualizado com sucesso.");
}

export async function toggleGlobalServiceAction(
  formData: FormData
): Promise<MutationResult> {
  await requireAdmin();

  const serviceId = String(formData.get("serviceId") || "").trim();
  const activeValue = formData.get("isActive");
  if (!serviceId || (activeValue !== "true" && activeValue !== "false")) {
    return mutationError("Informe o serviço e a disponibilidade desejada.");
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return mutationError("Serviço não encontrado.");

  const isActive = activeValue === "true";
  await prisma.service.update({ where: { id: serviceId }, data: { isActive } });

  revalidateServiceViews();
  return mutationSuccess(isActive ? "Serviço ativado." : "Serviço desativado.");
}

export async function deleteGlobalServiceAction(
  formData: FormData
): Promise<MutationResult> {
  await requireAdmin();

  const serviceId = String(formData.get("serviceId") || "");
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    return mutationError("Serviço não encontrado.");
  }

  const appointmentUses = await prisma.appointmentService.count({
    where: { serviceId },
  });

  if (appointmentUses > 0) {
    await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });

    revalidateServiceViews();
    return mutationSuccess(
      "Serviço desativado para preservar o histórico de agendamentos.",
      undefined,
      "info"
    );
  }

  await prisma.service.delete({
    where: { id: serviceId },
  });

  revalidateServiceViews();
  return mutationSuccess("Serviço excluído com sucesso.");
}
