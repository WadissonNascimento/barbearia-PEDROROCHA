"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { getPostLoginRedirect, sanitizeInternalRedirect } from "@/lib/authRedirect";
import type { FormFeedbackState } from "@/lib/formFeedbackState";
import { isGoogleSignInConfigured } from "@/lib/googleAuth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { getCurrentShopId } from "@/lib/shop";
import {
  getShopEmailRateLimitIdentifier,
  normalizeIdentityEmail,
} from "@/lib/userIdentity";

async function getLoginFailureMessage(shopId: string, email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { shopId, email },
    select: {
      id: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    return "Usuario nao encontrado ou e-mail incorreto.";
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  return passwordMatch ? null : "Senha incorreta.";
}

async function runLogin(formData: FormData): Promise<FormFeedbackState> {
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    return { error: "Preencha e-mail e senha.", success: null };
  }

  const rateLimit = await enforceRateLimit({
    scope: "login:action",
    identifier: getShopEmailRateLimitIdentifier(shopId, email),
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return {
      error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
      success: null,
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      logSecurityEvent("login_action_failed", { email });
      return {
        error:
          (await getLoginFailureMessage(shopId, email, password)) ||
          "Nao foi possivel autenticar. Confira e-mail e senha.",
        success: null,
      };
    }

    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      shopId,
      email,
    },
    select: {
      role: true,
    },
  });

  redirect(getPostLoginRedirect(user?.role));
}

export async function loginAction(
  _prevState: FormFeedbackState,
  formData: FormData
): Promise<FormFeedbackState> {
  return runLogin(formData);
}

export async function loginSubmitAction(formData: FormData) {
  const result = await runLogin(formData);

  if (result.error) {
    redirect(`/login?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/login");
}

export async function googleSignInAction(formData: FormData) {
  if (!isGoogleSignInConfigured()) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Login com Google ainda nao esta configurado."
      )}`
    );
  }

  const redirectTo = sanitizeInternalRedirect(
    formData.get("redirectTo"),
    "/redirecionar"
  );

  await signIn("google", {
    redirectTo,
  });
}
