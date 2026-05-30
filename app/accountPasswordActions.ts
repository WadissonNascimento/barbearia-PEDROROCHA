"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { sanitizeEmailInput } from "@/lib/inputSanitization";
import {
  isStrongPassword,
  NEW_PASSWORD_REQUIREMENT_MESSAGE,
} from "@/lib/passwordPolicy";
import {
  BRAZILIAN_PHONE_EXAMPLE,
  isValidBrazilianPhone,
  normalizeBrazilianPhoneForSubmit,
} from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import {
  BARBER_ROLES,
  requireTenantSession,
  SHOP_ADMIN_ROLES,
} from "@/lib/tenantSession";
import { isUniqueConstraintError } from "@/lib/userIdentity";

export async function updateOwnAdminContactAction(
  formData: FormData
): Promise<MutationResult> {
  const { user, shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  const rateLimit = await enforceRateLimit({
    scope: "admin_contact:update",
    identifier: user.id,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError("Muitas alteracoes em pouco tempo. Aguarde e tente novamente.");
  }

  const name = String(formData.get("name") || "").trim().replace(/\s+/g, " ");
  const email = sanitizeEmailInput(formData.get("email")?.toString() || "");
  const rawPhone = formData.get("phone")?.toString() || "";
  const phone = rawPhone.trim()
    ? normalizeBrazilianPhoneForSubmit(rawPhone)
    : "";

  if (name.length < 2 || name.length > 80) {
    return mutationError("Informe um nome valido.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return mutationError("Informe um e-mail valido.");
  }

  if (rawPhone.trim() && !isValidBrazilianPhone(phone)) {
    return mutationError(`Use um telefone no formato ${BRAZILIAN_PHONE_EXAMPLE}.`);
  }

  const emailOwner = await prisma.user.findFirst({
    where: {
      shopId,
      email,
      NOT: {
        id: user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (emailOwner) {
    return mutationError("Este e-mail ja esta em uso.");
  }

  try {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        name,
        email,
        phone: phone || null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      return mutationError("Este e-mail ja esta em uso.");
    }

    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/barber");
  revalidatePath("/admin/barbeiros");

  return mutationSuccess("Dados atualizados com sucesso.");
}

export async function updateOwnAccountPasswordAction(
  formData: FormData
): Promise<MutationResult> {
  const { user: sessionUser, shopId } = await requireTenantSession({
    roles: [...SHOP_ADMIN_ROLES, ...BARBER_ROLES],
  });

  const rateLimit = await enforceRateLimit({
    scope: `${sessionUser.role.toLowerCase()}_password:update`,
    identifier: sessionUser.id,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError("Muitas tentativas. Aguarde alguns minutos.");
  }

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return mutationError("Preencha senha atual, nova senha e confirmacao.");
  }

  if (!isStrongPassword(newPassword)) {
    return mutationError(NEW_PASSWORD_REQUIREMENT_MESSAGE);
  }

  if (newPassword !== confirmPassword) {
    return mutationError("A confirmacao da nova senha nao confere.");
  }

  if (newPassword === currentPassword) {
    return mutationError("A nova senha precisa ser diferente da senha atual.");
  }

  const account = await prisma.user.findFirst({
    where: {
      id: sessionUser.id,
      shopId,
      role: sessionUser.role,
    },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!account?.passwordHash) {
    return mutationError("Nao foi possivel trocar a senha desta conta.");
  }

  const passwordMatches = await bcrypt.compare(currentPassword, account.passwordHash);

  if (!passwordMatches) {
    logSecurityEvent("staff_password_update_failed", {
      reason: "bad_current_password",
      userId: sessionUser.id,
      role: sessionUser.role,
    });

    return mutationError("Senha atual invalida.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: {
      id: sessionUser.id,
    },
    data: {
      passwordHash,
    },
  });

  logSecurityEvent("staff_password_updated", {
    userId: sessionUser.id,
    role: sessionUser.role,
  });

  return mutationSuccess("Senha atualizada com sucesso.");
}
