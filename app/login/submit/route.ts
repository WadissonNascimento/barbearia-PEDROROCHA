import { AuthError } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { getPostLoginRedirect } from "@/lib/authRedirect";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import { getCurrentShopId } from "@/lib/shop";
import {
  getShopEmailRateLimitIdentifier,
  normalizeIdentityEmail,
} from "@/lib/userIdentity";

export const dynamic = "force-dynamic";
const CUSTOMER_LOGIN_ROLES = ["ADMIN", "SHOP_ADMIN", "BARBER", "CUSTOMER"];

function wantsJson(request: NextRequest) {
  return (
    request.headers.get("accept")?.includes("application/json") ||
    request.headers.get("x-requested-with") === "fetch"
  );
}

function loginErrorUrl(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);

  return url;
}

function loginError(request: NextRequest, message: string) {
  const url = loginErrorUrl(request, message);

  if (wantsJson(request)) {
    return NextResponse.json(
      { ok: false, error: message, redirectTo: `${url.pathname}${url.search}` },
      { status: 401 }
    );
  }

  return NextResponse.redirect(url, 303);
}

async function getLoginFailureMessage(shopId: string, email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { shopId, email },
    select: {
      id: true,
      isActive: true,
      passwordHash: true,
      role: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    !user.passwordHash ||
    !CUSTOMER_LOGIN_ROLES.includes(user.role)
  ) {
    return "Usuario nao encontrado ou e-mail incorreto.";
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  return passwordMatch ? null : "Senha incorreta.";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const shopId = await getCurrentShopId();
  const email = normalizeIdentityEmail(formData.get("email")?.toString());
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    return loginError(request, "Preencha e-mail e senha.");
  }

  const rateLimit = await enforceRateLimit({
    scope: "login:http",
    identifier: getShopEmailRateLimitIdentifier(shopId, email),
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return loginError(
      request,
      "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
    );
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      logSecurityEvent("login_submit_failed", { email });
      return loginError(
        request,
        (await getLoginFailureMessage(shopId, email, password)) ||
          "Nao foi possivel autenticar. Confira e-mail e senha."
      );
    }

    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      shopId,
      email,
      role: {
        in: CUSTOMER_LOGIN_ROLES,
      },
    },
    select: {
      role: true,
    },
  });
  const redirectTo = getPostLoginRedirect(user?.role);

  if (wantsJson(request)) {
    return NextResponse.json({ ok: true, redirectTo });
  }

  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}
