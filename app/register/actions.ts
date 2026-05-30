"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  isUsingDevelopmentMailFallback,
  sendVerificationCodeEmail,
} from "@/lib/mail";
import type { FormFeedbackState } from "@/lib/formFeedbackState";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { getCurrentShopAppUrl } from "@/lib/appUrl";
import { getPostLoginRedirect, sanitizeInternalRedirect } from "@/lib/authRedirect";
import { getCurrentShopId } from "@/lib/shop";
import { createRegistrationAutoLoginToken } from "@/lib/registrationAutoLogin";
import {
  getShopEmailRateLimitIdentifier,
  isUniqueConstraintError,
  normalizeIdentityEmail,
} from "@/lib/userIdentity";
import {
  CUSTOMER_PASSWORD_REQUIREMENT_MESSAGE,
  FULL_NAME_REQUIREMENT_MESSAGE,
  isValidCustomerFullName,
  isValidCustomerPassword,
  normalizeCustomerName,
} from "@/lib/customerRegistrationValidation";

function generateVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

function getExpirationDate() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

const MAX_CODE_ATTEMPTS = 5;

function buildPendingRegistrationRedirect(
  email: string,
  code?: string,
  redirectTo?: string
) {
  const devCodeQuery =
    code && isUsingDevelopmentMailFallback()
      ? `&devCode=${encodeURIComponent(code)}`
      : "";
  const redirectQuery = redirectTo
    ? `&redirectTo=${encodeURIComponent(redirectTo)}`
    : "";

  return `/register/verify?email=${encodeURIComponent(email)}&sent=1${devCodeQuery}${redirectQuery}`;
}

async function buildVerificationUrl(email: string, redirectTo?: string) {
  const redirectQuery = redirectTo
    ? `&redirectTo=${encodeURIComponent(redirectTo)}`
    : "";

  return `${await getCurrentShopAppUrl()}/register/verify?email=${encodeURIComponent(email)}${redirectQuery}`;
}

export async function registerCustomerAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const name = normalizeCustomerName(String(formData.get("name") || ""));
  const email = normalizeIdentityEmail(formData.get("email")?.toString());
  const password = String(formData.get("password") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const redirectTo = sanitizeInternalRedirect(
    formData.get("redirectTo"),
    ""
  );

  if (!name || !email || !phone || !password) {
    return {
      error: "Nome, e-mail, telefone e senha sao obrigatorios.",
      success: null,
    };
  }

  if (!isValidCustomerFullName(name)) {
    return {
      error: FULL_NAME_REQUIREMENT_MESSAGE,
      success: null,
    };
  }

  const rateLimit = await enforceRateLimit({
    scope: "register:start",
    identifier: getShopEmailRateLimitIdentifier(shopId, email),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return {
      error: "Muitas tentativas de cadastro. Aguarde e tente novamente.",
      success: null,
    };
  }

  if (!isValidCustomerPassword(password)) {
    return {
      error: CUSTOMER_PASSWORD_REQUIREMENT_MESSAGE,
      success: null,
    };
  }

  const existingUser = await prisma.user.findFirst({
    where: { shopId, email },
  });

  if (existingUser) {
    return {
      error: "Ja existe uma conta com esse e-mail.",
      success: null,
    };
  }

  const existingPendingRegistration = await prisma.pendingRegistration.findFirst({
    where: { shopId, email },
  });

  if (existingPendingRegistration) {
    if (existingPendingRegistration.expiresAt.getTime() < Date.now()) {
      await prisma.pendingRegistration.deleteMany({
        where: { shopId, email },
      });
    } else {
      redirect(
        buildPendingRegistrationRedirect(
          email,
          existingPendingRegistration.code,
          redirectTo
        )
      );
    }
  }

  const code = generateVerificationCode();
  const hashedPassword = await bcrypt.hash(password, 10);
  let pendingCreated = false;

  try {
    await prisma.pendingRegistration.create({
      data: {
        name,
        shopId,
        email,
        phone,
        passwordHash: hashedPassword,
        role: "CUSTOMER",
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
      verifyUrl: await buildVerificationUrl(email, redirectTo),
      accountLabel: "seu cadastro",
    });
  } catch (error) {
    if (pendingCreated) {
      await prisma.pendingRegistration.deleteMany({
        where: { shopId, email },
      });
    }

    if (isUniqueConstraintError(error, "email")) {
      return {
        error: "Ja existe uma conta ou cadastro pendente com esse e-mail.",
        success: null,
      };
    }

    return {
      error: "Nao foi possivel enviar o codigo de verificacao.",
      success: null,
    };
  }

  redirect(buildPendingRegistrationRedirect(email, code, redirectTo));
}

export async function verifyRegistrationCodeAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());
  const code = String(formData.get("code") || "").trim();
  const redirectTo = sanitizeInternalRedirect(
    formData.get("redirectTo"),
    getPostLoginRedirect("CUSTOMER")
  );

  if (!email || !code) {
    return {
      error: "Informe o e-mail e o codigo de verificacao.",
      success: null,
    };
  }

  const rateLimit = await enforceRateLimit({
    scope: "register:verify",
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

  const pending = await prisma.pendingRegistration.findFirst({
    where: { shopId, email },
  });

  if (!pending) {
    return {
      error: "Nao encontramos um cadastro pendente para esse e-mail.",
      success: null,
    };
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    return {
      error: "Esse codigo expirou. Solicite um novo envio.",
      success: null,
    };
  }

  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    return {
      error: "Muitas tentativas invalidas. Solicite um novo codigo.",
      success: null,
    };
  }

  if (pending.code !== code) {
    logSecurityEvent("registration_code_failed", { email });
    await prisma.pendingRegistration.update({
      where: { id: pending.id },
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

  const existingUser = await prisma.user.findFirst({
    where: { shopId, email },
  });

  if (existingUser) {
    await prisma.pendingRegistration.deleteMany({
      where: { shopId, email },
    });

    return {
      error: "Ja existe uma conta ativa com esse e-mail.",
      success: null,
    };
  }

  let user;

  try {
    user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: pending.name,
          shopId: pending.shopId,
          email: pending.email,
          passwordHash: pending.passwordHash,
          phone: pending.phone,
          role: pending.role,
          isActive: true,
          emailVerified: new Date(),
        },
      });

      await tx.pendingRegistration.delete({
        where: { id: pending.id },
      });

      return createdUser;
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      await prisma.pendingRegistration.deleteMany({
        where: { shopId, email },
      });

      return {
        error: "Ja existe uma conta ativa com esse e-mail.",
        success: null,
      };
    }

    throw error;
  }

  try {
    await signIn("registration-auto-login", {
      userId: user.id,
      token: createRegistrationAutoLoginToken(user.id),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        `/login?registered=1&error=${encodeURIComponent(
          "Conta criada com sucesso, mas nao foi possivel entrar automaticamente. Entre com seu e-mail e senha."
        )}`
      );
    }

    throw error;
  }

  redirect(redirectTo);
}

export async function resendRegistrationCodeAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());
  const redirectTo = sanitizeInternalRedirect(formData.get("redirectTo"), "");

  if (!email) {
    return {
      error: "Informe o e-mail para reenviar o codigo.",
      success: null,
    };
  }

  const rateLimit = await enforceRateLimit({
    scope: "register:resend",
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

  const pending = await prisma.pendingRegistration.findFirst({
    where: { shopId, email },
  });

  if (!pending) {
    return {
      error: "Nao encontramos um cadastro pendente para esse e-mail.",
      success: null,
    };
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    return {
      error: "O codigo anterior expirou. Recomece o cadastro para receber um novo.",
      success: null,
    };
  }

  const code = generateVerificationCode();
  const previousCode = pending.code;
  const previousExpiresAt = pending.expiresAt;
  const previousAttempts = pending.attempts;

  try {
    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        code,
        expiresAt: getExpirationDate(),
        attempts: 0,
      },
    });

    await sendVerificationCodeEmail({
      to: email,
      name: pending.name,
      code,
      verifyUrl: await buildVerificationUrl(email, redirectTo),
      accountLabel: "seu cadastro",
    });
  } catch (error) {
    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        code: previousCode,
        expiresAt: previousExpiresAt,
        attempts: previousAttempts,
      },
    });

    return {
      error: "Nao foi possivel reenviar o codigo.",
      success: null,
    };
  }

  return {
    error: null,
    success: isUsingDevelopmentMailFallback()
      ? `Codigo de verificacao local: ${code}`
      : "Enviamos um novo codigo para o seu e-mail.",
  };
}
