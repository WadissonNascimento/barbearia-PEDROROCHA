"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { sendVerificationCodeEmail } from "@/lib/mail";
import { getShopAppUrl } from "@/lib/appUrl";
import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { deleteLocalBarberPhoto, saveBarberPhoto } from "@/lib/barberPhoto";
import { prisma } from "@/lib/prisma";
import { createScheduleDateTimeInput } from "@/lib/scheduleTime";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { isUniqueConstraintError } from "@/lib/userIdentity";

async function requireAdmin() {
  const { user, shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return {
    ...user,
    shopId,
  };
}

function generateVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

function getExpirationDate() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

function buildVerificationUrl(
  email: string,
  shop: { primaryDomain?: string | null } | null,
) {
  return `${getShopAppUrl(shop)}/register/verify?email=${encodeURIComponent(email)}`;
}

function isValidTimeRange(startTime: string, endTime: string) {
  return (
    /^\d{2}:\d{2}$/.test(startTime) &&
    /^\d{2}:\d{2}$/.test(endTime) &&
    startTime < endTime
  );
}

async function requireAdminBarberTarget(formData: FormData) {
  const admin = await requireAdmin();
  const barberId = String(formData.get("barberId") || "").trim();

  if (!barberId) {
    return {
      admin,
      barber: null,
      error: "Barbeiro invalido.",
    };
  }

  const barber = await prisma.user.findFirst({
    where: {
      shopId: admin.shopId || undefined,
      id: barberId,
      role: "BARBER",
    },
    select: {
      id: true,
    },
  });

  if (!barber) {
    return {
      admin,
      barber: null,
      error: "Barbeiro nao encontrado.",
    };
  }

  return {
    admin,
    barber,
    error: null,
  };
}

function revalidateAdminBarberAvailabilityViews(barberId: string) {
  revalidatePath("/admin/barbeiros");
  revalidatePath(`/admin/barbeiros/${barberId}`);
  revalidatePath(`/admin/barbeiros/${barberId}/disponibilidade`);
  revalidatePath("/admin/agenda");
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");
  revalidatePath("/barber/disponibilidade");
  revalidatePath("/agendar");
}

async function getBarberCapacity(shopId: string | null | undefined) {
  if (!shopId) {
    return {
      limit: null,
      used: 0,
    };
  }

  const [shop, activeBarbers, pendingBarbers] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: shopId },
      select: { barberLimit: true },
    }),
    prisma.user.count({
      where: {
        shopId,
        role: "BARBER",
        isActive: true,
      },
    }),
    prisma.pendingRegistration.count({
      where: {
        shopId,
        role: "BARBER",
        expiresAt: {
          gt: new Date(),
        },
      },
    }),
  ]);

  return {
    limit: shop?.barberLimit ?? null,
    used: activeBarbers + pendingBarbers,
  };
}

async function assertCanAddActiveBarber(shopId: string | null | undefined) {
  const capacity = await getBarberCapacity(shopId);

  if (capacity.limit !== null && capacity.used >= capacity.limit) {
    return `Limite de barbeiros atingido (${capacity.used}/${capacity.limit}). Fale com o suporte para aumentar o plano.`;
  }

  return null;
}

export async function createBarberAction(
  formData: FormData,
): Promise<MutationResult> {
  const admin = await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!name || !email || !password) {
    return mutationError("Nome, e-mail e senha sao obrigatorios.");
  }

  if (password.length < 6) {
    return mutationError("A senha deve ter pelo menos 6 caracteres.");
  }

  const capacityError = await assertCanAddActiveBarber(admin.shopId);

  if (capacityError) {
    return mutationError(capacityError);
  }

  const [existingUser, existingPendingRegistration, shop] = await Promise.all([
    prisma.user.findFirst({
      where: { shopId: admin.shopId || undefined, email },
    }),
    prisma.pendingRegistration.findFirst({
      where: { shopId: admin.shopId || undefined, email },
    }),
    admin.shopId
      ? prisma.shop.findUnique({
          where: { id: admin.shopId },
          select: { primaryDomain: true },
        })
      : null,
  ]);

  if (existingUser) {
    return mutationError(
      existingUser.isActive
        ? "Ja existe uma conta ativa com esse e-mail."
        : "Ja existe um barbeiro desligado com esse e-mail. Reative a conta existente em vez de criar outra.",
    );
  }

  if (existingPendingRegistration) {
    return mutationError(
      "Ja existe um cadastro pendente com esse e-mail. O barbeiro precisa concluir a verificacao antes de um novo convite.",
    );
  }

  const code = generateVerificationCode();
  const hashedPassword = await bcrypt.hash(password, 10);
  let pendingCreated = false;

  try {
    await prisma.pendingRegistration.create({
      data: {
        name,
        shopId: admin.shopId || undefined,
        email,
        phone: phone || null,
        passwordHash: hashedPassword,
        role: "BARBER",
        code,
        expiresAt: getExpirationDate(),
        attempts: 0,
      },
    });
    pendingCreated = true;

    await sendVerificationCodeEmail({
      to: email,
      name,
      code,
      verifyUrl: buildVerificationUrl(email, shop),
      accountLabel: "o cadastro de barbeiro",
    });
  } catch (error) {
    if (pendingCreated) {
      await prisma.pendingRegistration.deleteMany({
        where: { shopId: admin.shopId || undefined, email },
      });
    }

    if (isUniqueConstraintError(error, "email")) {
      return mutationError(
        "Ja existe uma conta ou cadastro pendente com esse e-mail.",
      );
    }

    return mutationError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel enviar o convite do barbeiro.",
    );
  }

  revalidatePath("/admin/barbeiros");
  return mutationSuccess(
    "Convite enviado. O barbeiro precisa confirmar o e-mail para ativar a conta.",
  );
}

export async function toggleBarberStatusAction(
  formData: FormData,
): Promise<MutationResult> {
  const admin = await requireAdmin();

  const barberId = String(formData.get("barberId") || "");
  const currentActive = String(formData.get("currentActive") || "") === "true";

  if (!barberId) {
    return mutationError("Barbeiro invalido.");
  }

  const barber = await prisma.user.findFirst({
    where: {
      shopId: admin.shopId || undefined,
      id: barberId,
      role: "BARBER",
    },
    select: {
      id: true,
    },
  });

  if (!barber) {
    return mutationError("Barbeiro nao encontrado.");
  }

  if (!currentActive) {
    const capacityError = await assertCanAddActiveBarber(admin.shopId);

    if (capacityError) {
      return mutationError(capacityError);
    }
  }

  await prisma.user.update({
    where: { id: barberId },
    data: {
      isActive: !currentActive,
    },
  });

  revalidatePath("/admin/barbeiros");
  revalidatePath(`/admin/barbeiros/${barberId}`);
  revalidatePath("/admin/agenda");
  return mutationSuccess(
    currentActive ? "Barbeiro inativado." : "Barbeiro reativado.",
  );
}

export async function updateBarberPhotoAction(
  formData: FormData,
): Promise<MutationResult | MutationResult<{ image: string }>> {
  const admin = await requireAdmin();

  const barberId = String(formData.get("barberId") || "");
  const file = formData.get("photo");

  if (!barberId) {
    return mutationError("Barbeiro invalido.");
  }

  if (!(file instanceof File)) {
    return mutationError("Escolha uma foto para enviar.");
  }

  const barber = await prisma.user.findFirst({
    where: {
      shopId: admin.shopId || undefined,
      id: barberId,
      role: "BARBER",
    },
    select: {
      id: true,
      image: true,
    },
  });

  if (!barber) {
    return mutationError("Barbeiro nao encontrado.");
  }

  try {
    const image = await saveBarberPhoto(file);

    await prisma.user.update({
      where: {
        id: barber.id,
      },
      data: {
        image,
      },
    });

    await deleteLocalBarberPhoto(barber.image);

    revalidatePath("/admin/barbeiros");
    revalidatePath(`/admin/barbeiros/${barber.id}`);
    revalidatePath("/admin");
    revalidatePath("/agendar");

    return mutationSuccess("Foto do barbeiro atualizada.", { image });
  } catch (error) {
    return mutationError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar a foto.",
    );
  }
}

export async function deleteBarberAction(
  formData: FormData,
): Promise<MutationResult> {
  const admin = await requireAdmin();

  const barberId = String(formData.get("barberId") || "");

  if (!barberId) {
    return mutationError("Barbeiro invalido.");
  }

  const barber = await prisma.user.findFirst({
    where: {
      shopId: admin.shopId || undefined,
      id: barberId,
      role: "BARBER",
    },
    select: {
      id: true,
    },
  });

  if (!barber) {
    return mutationError("Barbeiro nao encontrado.");
  }

  await prisma.user.update({
    where: { id: barberId },
    data: {
      isActive: false,
      role: "BARBER_ARCHIVED",
    },
  });

  revalidatePath("/admin/barbeiros");
  revalidatePath(`/admin/barbeiros/${barberId}`);
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/servicos");
  revalidatePath("/agendar");
  revalidatePath("/meu-perfil");
  return mutationSuccess(
    "Barbeiro excluido da equipe. Historico, agendamentos antigos e fechamentos foram preservados.",
  );
}

export async function upsertBarberServiceCommissionAction(
  formData: FormData,
): Promise<MutationResult> {
  const admin = await requireAdmin();

  const barberId = String(formData.get("barberId") || "").trim();
  const serviceId = String(formData.get("serviceId") || "").trim();
  const commissionType =
    String(formData.get("commissionType") || "PERCENT") === "FIXED"
      ? "FIXED"
      : "PERCENT";
  const commissionValue = Number(formData.get("commissionValue") || 0);

  if (
    !barberId ||
    !serviceId ||
    !Number.isFinite(commissionValue) ||
    commissionValue < 0 ||
    (commissionType === "PERCENT" && commissionValue > 100)
  ) {
    return mutationError("Preencha a comissao corretamente.");
  }

  const [barber, service] = await Promise.all([
    prisma.user.findFirst({
      where: {
        shopId: admin.shopId || undefined,
        id: barberId,
        role: "BARBER",
      },
      select: { id: true },
    }),
    prisma.service.findFirst({
      where: {
        shopId: admin.shopId || undefined,
        id: serviceId,
        OR: [{ barberId }, { barberId: null }],
      },
      select: { id: true },
    }),
  ]);

  if (!barber) {
    return mutationError("Barbeiro nao encontrado.");
  }

  if (!service) {
    return mutationError("Servico nao encontrado para esse barbeiro.");
  }

  await prisma.barberServiceCommission.upsert({
    where: {
      barberId_serviceId: {
        barberId,
        serviceId,
      },
    },
    update: {
      commissionType,
      commissionValue,
    },
    create: {
      shopId: admin.shopId || undefined,
      barberId,
      serviceId,
      commissionType,
      commissionValue,
    },
  });

  revalidatePath("/admin/barbeiros");
  revalidatePath(`/admin/barbeiros/${barberId}`);
  revalidatePath("/admin/financeiro");
  revalidatePath("/barber");
  return mutationSuccess("Comissao do barbeiro atualizada.");
}

export async function saveAdminBarberAvailabilityAction(
  formData: FormData,
): Promise<MutationResult> {
  const { barber, error } = await requireAdminBarberTarget(formData);
  const weekDay = Number(formData.get("weekDay") || -1);
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const isActive = String(formData.get("isActive") || "false") === "true";

  if (!barber) {
    return mutationError(error || "Barbeiro invalido.");
  }

  if (weekDay < 0 || weekDay > 6 || !isValidTimeRange(startTime, endTime)) {
    return mutationError("Disponibilidade invalida.");
  }

  await prisma.barberAvailability.upsert({
    where: {
      barberId_weekDay: {
        barberId: barber.id,
        weekDay,
      },
    },
    update: {
      startTime,
      endTime,
      isActive,
    },
    create: {
      barberId: barber.id,
      weekDay,
      startTime,
      endTime,
      isActive,
    },
  });

  revalidateAdminBarberAvailabilityViews(barber.id);
  return mutationSuccess("Disponibilidade do barbeiro atualizada.");
}

export async function createAdminBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const { barber, error } = await requireAdminBarberTarget(formData);
  const startDateTime = createScheduleDateTimeInput(
    String(formData.get("startDateTime") || ""),
  );
  const endDateTime = createScheduleDateTimeInput(
    String(formData.get("endDateTime") || ""),
  );
  const reason = String(formData.get("reason") || "").trim();

  if (!barber) {
    return mutationError(error || "Barbeiro invalido.");
  }

  if (!startDateTime || !endDateTime || startDateTime >= endDateTime) {
    return mutationError("Periodo de bloqueio invalido.");
  }

  await prisma.barberBlock.create({
    data: {
      barberId: barber.id,
      startDateTime,
      endDateTime,
      reason: reason || null,
    },
  });

  revalidateAdminBarberAvailabilityViews(barber.id);
  return mutationSuccess("Bloqueio criado para o barbeiro.");
}

export async function updateAdminBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const { barber, error } = await requireAdminBarberTarget(formData);
  const blockId = String(formData.get("blockId") || "").trim();
  const startDateTime = createScheduleDateTimeInput(
    String(formData.get("startDateTime") || ""),
  );
  const endDateTime = createScheduleDateTimeInput(
    String(formData.get("endDateTime") || ""),
  );
  const reason = String(formData.get("reason") || "").trim();

  if (!barber) {
    return mutationError(error || "Barbeiro invalido.");
  }

  if (!startDateTime || !endDateTime || startDateTime >= endDateTime) {
    return mutationError("Periodo de bloqueio invalido.");
  }

  const block = await prisma.barberBlock.findUnique({
    where: { id: blockId },
  });

  if (!block || block.barberId !== barber.id) {
    return mutationError("Bloqueio nao encontrado para este barbeiro.");
  }

  await prisma.barberBlock.update({
    where: { id: block.id },
    data: {
      startDateTime,
      endDateTime,
      reason: reason || null,
    },
  });

  revalidateAdminBarberAvailabilityViews(barber.id);
  return mutationSuccess("Bloqueio atualizado.");
}

export async function createAdminRecurringBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const { barber, error } = await requireAdminBarberTarget(formData);
  const weekDay = Number(formData.get("weekDay") || -1);
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!barber) {
    return mutationError(error || "Barbeiro invalido.");
  }

  if (weekDay < 0 || weekDay > 6 || !isValidTimeRange(startTime, endTime)) {
    return mutationError("Bloqueio recorrente invalido.");
  }

  await prisma.recurringBarberBlock.create({
    data: {
      barberId: barber.id,
      weekDay,
      startTime,
      endTime,
      reason: reason || null,
      isActive: true,
    },
  });

  revalidateAdminBarberAvailabilityViews(barber.id);
  return mutationSuccess("Pausa fixa criada para o barbeiro.");
}

export async function updateAdminRecurringBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const { barber, error } = await requireAdminBarberTarget(formData);
  const recurringBlockId = String(
    formData.get("recurringBlockId") || "",
  ).trim();
  const weekDay = Number(formData.get("weekDay") || -1);
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!barber) {
    return mutationError(error || "Barbeiro invalido.");
  }

  if (weekDay < 0 || weekDay > 6 || !isValidTimeRange(startTime, endTime)) {
    return mutationError("Pausa fixa invalida.");
  }

  const recurringBlock = await prisma.recurringBarberBlock.findUnique({
    where: { id: recurringBlockId },
  });

  if (!recurringBlock || recurringBlock.barberId !== barber.id) {
    return mutationError("Pausa fixa nao encontrada para este barbeiro.");
  }

  await prisma.recurringBarberBlock.update({
    where: { id: recurringBlock.id },
    data: {
      weekDay,
      startTime,
      endTime,
      reason: reason || null,
    },
  });

  revalidateAdminBarberAvailabilityViews(barber.id);
  return mutationSuccess("Pausa fixa atualizada para o barbeiro.");
}

export async function deleteAdminRecurringBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const { barber, error } = await requireAdminBarberTarget(formData);
  const recurringBlockId = String(
    formData.get("recurringBlockId") || "",
  ).trim();

  if (!barber) {
    return mutationError(error || "Barbeiro invalido.");
  }

  const recurringBlock = await prisma.recurringBarberBlock.findUnique({
    where: { id: recurringBlockId },
  });

  if (!recurringBlock || recurringBlock.barberId !== barber.id) {
    return mutationError("Pausa fixa nao encontrada para este barbeiro.");
  }

  await prisma.recurringBarberBlock.delete({
    where: { id: recurringBlock.id },
  });

  revalidateAdminBarberAvailabilityViews(barber.id);
  return mutationSuccess("Pausa fixa removida.");
}

export async function deleteAdminBarberBlockAction(
  formData: FormData,
): Promise<MutationResult> {
  const { barber, error } = await requireAdminBarberTarget(formData);
  const blockId = String(formData.get("blockId") || "").trim();

  if (!barber) {
    return mutationError(error || "Barbeiro invalido.");
  }

  const block = await prisma.barberBlock.findUnique({
    where: { id: blockId },
  });

  if (!block || block.barberId !== barber.id) {
    return mutationError("Bloqueio nao encontrado para este barbeiro.");
  }

  await prisma.barberBlock.delete({
    where: { id: block.id },
  });

  revalidateAdminBarberAvailabilityViews(barber.id);
  return mutationSuccess("Bloqueio removido.");
}
