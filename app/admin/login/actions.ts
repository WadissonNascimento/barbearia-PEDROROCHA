"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { FormFeedbackState } from "@/lib/formFeedbackState";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { getCurrentShopId } from "@/lib/shop";
import {
  getShopEmailRateLimitIdentifier,
  normalizeIdentityEmail,
} from "@/lib/userIdentity";

const ADMIN_EMAIL_ERROR = "Usuario nao encontrado ou e-mail incorreto.";
const ADMIN_PASSWORD_ERROR = "Senha incorreta.";
const ADMIN_PERMISSION_ERROR = "Usuario sem permissao de administrador.";
const ADMIN_LOGIN_ROLES = ["ADMIN", "SHOP_ADMIN"];

async function runAdminLogin(formData: FormData): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    return { error: "Preencha e-mail e senha.", success: null };
  }

  const rateLimit = await enforceRateLimit({
    scope: "admin_login:action",
    identifier: getShopEmailRateLimitIdentifier(shopId, email),
    limit: 6,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return {
      error: "Muitas tentativas de login admin. Aguarde alguns minutos.",
      success: null,
    };
  }

  const user = await prisma.user.findFirst({
    where: { shopId, email },
  });

  if (!user || !user.passwordHash) {
    logSecurityEvent("admin_login_failed", { reason: "not_found", email });
    return { error: ADMIN_EMAIL_ERROR, success: null };
  }

  if (!user.isActive || !ADMIN_LOGIN_ROLES.includes(user.role)) {
    logSecurityEvent("admin_login_failed", {
      reason: !user.isActive ? "inactive" : "not_admin",
      userId: user.id,
    });
    return { error: ADMIN_PERMISSION_ERROR, success: null };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    logSecurityEvent("admin_login_failed", { reason: "bad_password", userId: user.id });
    return { error: ADMIN_PASSWORD_ERROR, success: null };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Nao foi possivel entrar no painel admin.", success: null };
    }

    throw error;
  }

  redirect("/admin");
}

export async function adminLoginAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  return runAdminLogin(formData);
}

export async function adminLoginSubmitAction(formData: FormData) {
  const result = await runAdminLogin(formData);

  if (result.error) {
    redirect(`/admin/login?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/admin/login");
}
