"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import type { FormFeedbackState } from "@/lib/formFeedbackState";
import {
  isUsingDevelopmentMailFallback,
  sendPasswordResetCodeEmail,
} from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import {
  isStrongPassword,
  NEW_PASSWORD_REQUIREMENT_MESSAGE,
} from "@/lib/passwordPolicy";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { getCurrentShopId } from "@/lib/shop";
import {
  getShopEmailRateLimitIdentifier,
  isUniqueConstraintError,
  normalizeIdentityEmail,
} from "@/lib/userIdentity";

function generateCode() {
  return randomInt(100000, 1000000).toString();
}

function getExpirationDate() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

const MAX_RESET_ATTEMPTS = 5;

export async function requestPasswordResetAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());

  if (!email) {
    return {
      error: "Informe o e-mail da sua conta.",
      success: null,
    };
  }

  const rateLimit = await enforceRateLimit({
    scope: "password_reset:start",
    identifier: getShopEmailRateLimitIdentifier(shopId, email),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return {
      error: "Muitas solicitacoes de recuperacao. Aguarde e tente novamente.",
      success: null,
    };
  }

  const user = await prisma.user.findFirst({
    where: { shopId, email },
  });

  if (!user || !user.passwordHash) {
    const pendingRegistration = await prisma.pendingRegistration.findFirst({
      where: { shopId, email },
    });

    if (pendingRegistration) {
      return {
        error:
          "Esse e-mail ainda esta com cadastro pendente. Volte para a tela de cadastro e finalize a verificacao do codigo.",
        success: null,
      };
    }

    return {
      error:
        "Se existir uma conta ativa com esse e-mail, enviaremos um codigo de recuperacao.",
      success: null,
    };
  }

  const code = generateCode();

  try {
    const existingResetRequest = await prisma.passwordResetRequest.findFirst({
      where: { shopId, email },
      select: { id: true },
    });

    if (existingResetRequest) {
      await prisma.passwordResetRequest.update({
        where: { id: existingResetRequest.id },
        data: {
          code,
          expiresAt: getExpirationDate(),
          attempts: 0,
        },
      });
    } else {
      await prisma.passwordResetRequest.create({
        data: {
          shopId,
          email,
          code,
          expiresAt: getExpirationDate(),
        },
      });
    }

    await sendPasswordResetCodeEmail({
      to: email,
      name: user.name || "cliente",
      code,
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      return {
        error:
          "Este e-mail existe em outra barbearia. A recuperacao por loja sera liberada na proxima etapa.",
        success: null,
      };
    }

    return {
      error: "Nao foi possivel enviar o codigo de recuperacao.",
      success: null,
    };
  }

  const devCode = isUsingDevelopmentMailFallback()
    ? `&devCode=${encodeURIComponent(code)}`
    : "";

  redirect(`/forgot-password/reset?email=${encodeURIComponent(email)}&sent=1${devCode}`);
}

export async function resendPasswordResetCodeAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());

  if (!email) {
    return {
      error: "Informe o e-mail para reenviar o codigo.",
      success: null,
    };
  }

  const rateLimit = await enforceRateLimit({
    scope: "password_reset:resend",
    identifier: getShopEmailRateLimitIdentifier(shopId, email),
    limit: 3,
    windowMs: 30 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return {
      error: "Muitos reenvios solicitados. Aguarde e tente novamente.",
      success: null,
    };
  }

  const [resetRequest, user] = await Promise.all([
    prisma.passwordResetRequest.findFirst({
      where: { shopId, email },
    }),
    prisma.user.findFirst({
      where: { shopId, email },
    }),
  ]);

  if (!resetRequest || !user) {
    return {
      error: "Nao encontramos uma solicitacao de recuperacao para esse e-mail.",
      success: null,
    };
  }

  const code = generateCode();

  try {
    await prisma.passwordResetRequest.update({
      where: { id: resetRequest.id },
      data: {
        code,
        expiresAt: getExpirationDate(),
        attempts: 0,
      },
    });

    await sendPasswordResetCodeEmail({
      to: email,
      name: user.name || "cliente",
      code,
    });
  } catch (error) {
    return {
      error: "Nao foi possivel reenviar o codigo.",
      success: null,
    };
  }

  return {
    error: null,
    success: isUsingDevelopmentMailFallback()
      ? `Codigo de recuperacao local: ${code}`
      : "Enviamos um novo codigo de recuperacao para o seu e-mail.",
  };
}

export async function resetPasswordWithCodeAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());
  const code = String(formData.get("code") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const confirmPassword = String(formData.get("confirmPassword") || "").trim();

  if (!email || !code || !password || !confirmPassword) {
    return {
      error: "Preencha e-mail, codigo e nova senha.",
      success: null,
    };
  }

  const rateLimit = await enforceRateLimit({
    scope: "password_reset:verify",
    identifier: getShopEmailRateLimitIdentifier(shopId, email),
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return {
      error: "Muitas tentativas de verificacao. Aguarde e tente novamente.",
      success: null,
    };
  }

  if (!isStrongPassword(password)) {
    return {
      error: NEW_PASSWORD_REQUIREMENT_MESSAGE,
      success: null,
    };
  }

  if (password !== confirmPassword) {
    return {
      error: "As senhas informadas nao conferem.",
      success: null,
    };
  }

  const resetRequest = await prisma.passwordResetRequest.findFirst({
    where: { shopId, email },
  });

  if (!resetRequest) {
    return {
      error: "Nao encontramos uma solicitacao de recuperacao para esse e-mail.",
      success: null,
    };
  }

  if (resetRequest.expiresAt.getTime() < Date.now()) {
    return {
      error: "Esse codigo expirou. Solicite um novo envio.",
      success: null,
    };
  }

  if (resetRequest.attempts >= MAX_RESET_ATTEMPTS) {
    return {
      error: "Muitas tentativas invalidas. Solicite um novo codigo.",
      success: null,
    };
  }

  if (resetRequest.code !== code) {
    logSecurityEvent("password_reset_code_failed", { email });
    await prisma.passwordResetRequest.update({
      where: { id: resetRequest.id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    return {
      error: "Codigo invalido. Confira o e-mail e tente novamente.",
      success: null,
    };
  }

  const user = await prisma.user.findFirst({
    where: { shopId, email },
  });

  if (!user) {
    await prisma.passwordResetRequest.deleteMany({
      where: { shopId, email },
    });

    return {
      error: "Nao encontramos uma conta ativa com esse e-mail.",
      success: null,
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
      },
    }),
    prisma.passwordResetRequest.delete({
      where: { id: resetRequest.id },
    }),
  ]);

  redirect("/login?reset=1");
}
