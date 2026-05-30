"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { getShopAppUrl } from "@/lib/appUrl";
import {
  FULL_NAME_REQUIREMENT_MESSAGE,
  isValidCustomerFullName,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";
import { sanitizeEmailInput } from "@/lib/inputSanitization";
import {
  isUsingDevelopmentMailFallback,
  sendVerificationCodeEmail,
} from "@/lib/mail";
import {
  BRAZILIAN_PHONE_EXAMPLE,
  isValidBrazilianPhone,
  normalizeBrazilianPhoneForSubmit,
} from "@/lib/phone";
import {
  isStrongPassword,
  NEW_PASSWORD_REQUIREMENT_MESSAGE,
} from "@/lib/passwordPolicy";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { CUSTOMER_ROLES, getTenantSession } from "@/lib/tenantSession";
import { isUniqueConstraintError } from "@/lib/userIdentity";

const MAX_EMAIL_CHANGE_ATTEMPTS = 5;

function generateVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

function getEmailChangeExpirationDate() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

function buildEmailChangeVerifyUrl(shop: { primaryDomain?: string | null } | null) {
  return `${getShopAppUrl(shop)}/meu-perfil`;
}

export async function updateCustomerProfileAction(
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });

  if (!tenantSession) {
    throw new Error("Nao autorizado.");
  }
  const { session } = tenantSession;

  const name = normalizeCustomerName(String(formData.get("name") || ""));
  const email = sanitizeEmailInput(formData.get("email")?.toString() || "");
  const rawPhone = formData.get("phone")?.toString() || "";
  const phone = rawPhone.trim()
    ? normalizeBrazilianPhoneForSubmit(rawPhone)
    : "";

  if (!name) {
    return mutationError("Informe seu nome.");
  }

  if (!isValidCustomerFullName(name)) {
    return mutationError(FULL_NAME_REQUIREMENT_MESSAGE);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return mutationError("Informe um e-mail valido.");
  }

  if (rawPhone.trim() && !isValidBrazilianPhone(phone)) {
    return mutationError(`Use um telefone no formato ${BRAZILIAN_PHONE_EXAMPLE}.`);
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      email: true,
      name: true,
      shopId: true,
      shop: {
        select: {
          primaryDomain: true,
        },
      },
    },
  });

  if (!currentUser) {
    return mutationError("Nao foi possivel atualizar seu perfil.");
  }

  const emailOwner = await prisma.user.findFirst({
    where: {
      shopId: currentUser.shopId,
      email,
      NOT: {
        id: session.user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (emailOwner) {
    return mutationError("Este e-mail ja esta em uso.");
  }

  const emailChanged = currentUser.email?.toLowerCase() !== email;

  if (emailChanged) {
    const rateLimit = await enforceRateLimit({
      scope: "customer_email_change:start",
      identifier: session.user.id,
      limit: 4,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return mutationError("Muitas tentativas de troca de e-mail. Aguarde e tente novamente.");
    }

    const pendingEmailOwner = await prisma.emailChangeRequest.findFirst({
      where: {
        shopId: currentUser.shopId,
        email,
        NOT: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (pendingEmailOwner) {
      return mutationError("Esse e-mail ja possui uma verificacao pendente.");
    }

    const code = generateVerificationCode();
    const expiresAt = getEmailChangeExpirationDate();

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.user.id },
          data: {
            name,
            phone: phone || null,
          },
        }),
        prisma.emailChangeRequest.deleteMany({
          where: {
            userId: session.user.id,
          },
        }),
        prisma.emailChangeRequest.create({
          data: {
            shopId: currentUser.shopId,
            userId: session.user.id,
            email,
            code,
            expiresAt,
            attempts: 0,
          },
        }),
      ]);
    } catch (error) {
      if (isUniqueConstraintError(error, "email")) {
        return mutationError(
          "Este e-mail ja esta em uso ou possui verificacao pendente."
        );
      }

      throw error;
    }

    try {
      await sendVerificationCodeEmail({
        to: email,
        name,
        code,
        verifyUrl: buildEmailChangeVerifyUrl(currentUser.shop),
        accountLabel: "troca de e-mail",
      });
    } catch {
      await prisma.emailChangeRequest.deleteMany({
        where: {
          userId: session.user.id,
        },
      });

      return mutationError("Nao foi possivel enviar o codigo de verificacao do e-mail.");
    }

    logSecurityEvent("customer_email_change_requested", {
      userId: session.user.id,
    });

    revalidatePath("/meu-perfil");
    return mutationSuccess(
      isUsingDevelopmentMailFallback()
        ? `Codigo de verificacao local: ${code}`
        : "Enviamos um codigo para confirmar o novo e-mail. O telefone foi salvo sem verificacao por SMS."
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        email,
        phone: phone || null,
      },
    }),
    prisma.emailChangeRequest.deleteMany({
      where: {
        userId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/meu-perfil");
  return mutationSuccess("Perfil atualizado com sucesso.");
}

export async function verifyCustomerEmailChangeAction(
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });

  if (!tenantSession) {
    throw new Error("Nao autorizado.");
  }
  const { session } = tenantSession;

  const code = String(formData.get("code") || "").trim();

  if (!code) {
    return mutationError("Informe o codigo de verificacao do e-mail.");
  }

  const rateLimit = await enforceRateLimit({
    scope: "customer_email_change:verify",
    identifier: session.user.id,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return mutationError("Muitas tentativas de verificacao. Aguarde e tente novamente.");
  }

  const pending = await prisma.emailChangeRequest.findFirst({
    where: {
      userId: session.user.id,
    },
  });

  if (!pending) {
    return mutationError("Nao ha troca de e-mail pendente para confirmar.");
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.emailChangeRequest.deleteMany({
      where: {
        userId: session.user.id,
      },
    });

    return mutationError("Esse codigo expirou. Solicite a troca de e-mail novamente.");
  }

  if (pending.attempts >= MAX_EMAIL_CHANGE_ATTEMPTS) {
    return mutationError("Muitas tentativas invalidas. Solicite um novo codigo.");
  }

  if (pending.code !== code) {
    await prisma.emailChangeRequest.update({
      where: {
        userId: session.user.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    return mutationError("Codigo invalido. Confira o e-mail e tente novamente.");
  }

  const emailOwner = await prisma.user.findFirst({
    where: {
      shopId: pending.shopId,
      email: pending.email,
      NOT: {
        id: session.user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (emailOwner) {
    await prisma.emailChangeRequest.deleteMany({
      where: {
        userId: session.user.id,
      },
    });

    return mutationError("Este e-mail ja esta em uso.");
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          email: pending.email,
          emailVerified: new Date(),
        },
      }),
      prisma.emailChangeRequest.deleteMany({
        where: {
          userId: session.user.id,
        },
      }),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      return mutationError("Este e-mail ja esta em uso.");
    }

    throw error;
  }

  logSecurityEvent("customer_email_change_verified", {
    userId: session.user.id,
  });

  revalidatePath("/meu-perfil");
  return mutationSuccess("E-mail verificado e atualizado com sucesso.");
}

export async function updateCustomerPasswordAction(
  formData: FormData
): Promise<MutationResult> {
  const tenantSession = await getTenantSession({
    roles: CUSTOMER_ROLES,
  });

  if (!tenantSession) {
    throw new Error("Nao autorizado.");
  }
  const { session } = tenantSession;

  const rateLimit = await enforceRateLimit({
    scope: "customer_password:update",
    identifier: session.user.id,
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

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user?.passwordHash) {
    return mutationError("Nao foi possivel trocar a senha desta conta.");
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!passwordMatches) {
    logSecurityEvent("customer_password_update_failed", {
      reason: "bad_current_password",
      userId: session.user.id,
    });
    return mutationError("Senha atual invalida.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      passwordHash,
    },
  });

  return mutationSuccess("Senha atualizada com sucesso.");
}
