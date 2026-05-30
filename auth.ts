import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  isGoogleSignInConfigured,
} from "@/lib/googleAuth";
import { verifyRegistrationAutoLoginToken } from "@/lib/registrationAutoLogin";
import {
  DEFAULT_SHOP_ID,
  getCurrentShopId,
  getRequestHost,
  getRequestPath,
  logTenantObservabilityEvent,
} from "@/lib/shop";
import {
  getShopEmailRateLimitIdentifier,
  isUniqueConstraintError,
  normalizeIdentityEmail,
} from "@/lib/userIdentity";

const googleSignInConfigured = isGoogleSignInConfigured();
const CREDENTIAL_LOGIN_ROLES = ["ADMIN", "SHOP_ADMIN", "BARBER", "CUSTOMER"];

async function getAuthShopIdWithFallback(fallbackReason: string) {
  return getCurrentShopId().catch(async (error) => {
    const [host, path] = await Promise.all([
      getRequestHost().catch(() => null),
      getRequestPath().catch(() => null),
    ]);

    logTenantObservabilityEvent({
      event: "tenant_auth_fallback_used",
      host,
      path,
      resolvedShopId: DEFAULT_SHOP_ID,
      usedFallback: true,
      fallbackReason,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });

    return DEFAULT_SHOP_ID;
  });
}

function getGoogleProviders() {
  if (!googleSignInConfigured) {
    return [];
  }

  return [
    Google({
      clientId: getGoogleClientId(),
      clientSecret: getGoogleClientSecret(),
    }),
  ];
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,

  providers: [
    Credentials({
      name: "credentials",

      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },

      async authorize(credentials) {
        const email = normalizeIdentityEmail(String(credentials?.email || ""));
        const password = String(credentials?.password || "");

        if (!email || !password) return null;

        const shopId = await getAuthShopIdWithFallback(
          "credentials_getCurrentShopId_failed"
        );
        const rateLimit = await enforceRateLimit({
          scope: "auth:credentials",
          identifier: getShopEmailRateLimitIdentifier(shopId, email),
          limit: 8,
          windowMs: 15 * 60 * 1000,
        });

        if (!rateLimit.allowed) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: { shopId, email },
        });

        if (
          !user ||
          !user.isActive ||
          !user.passwordHash ||
          !CREDENTIAL_LOGIN_ROLES.includes(user.role)
        ) {
          logSecurityEvent("login_failed", {
            reason: "user_not_found_or_inactive",
            email,
          });
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
          logSecurityEvent("login_failed", {
            reason: "bad_password",
            userId: user.id,
          });
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.isActive,
          shopId: user.shopId,
        };
      },
    }),
    Credentials({
      id: "registration-auto-login",
      name: "registration-auto-login",

      credentials: {
        userId: { label: "User ID", type: "text" },
        token: { label: "Token", type: "text" },
      },

      async authorize(credentials) {
        const userId = String(credentials?.userId || "").trim();
        const token = String(credentials?.token || "").trim();

        if (!userId || !token) return null;

        if (!verifyRegistrationAutoLoginToken(userId, token)) {
          logSecurityEvent("registration_auto_login_failed", { userId });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user || !user.isActive || user.role !== "CUSTOMER") {
          logSecurityEvent("registration_auto_login_failed", {
            reason: "user_not_allowed",
            userId,
          });
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.isActive,
          shopId: user.shopId,
        };
      },
    }),
    ...getGoogleProviders(),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = normalizeIdentityEmail(user.email);
      const emailVerified = (profile as { email_verified?: boolean } | undefined)
        ?.email_verified;

      if (!email || emailVerified === false) {
        logSecurityEvent("google_login_failed", {
          reason: "email_not_verified",
          email,
        });
        return false;
      }

      const shopId = await getAuthShopIdWithFallback(
        "google_signIn_getCurrentShopId_failed"
      );
      const existingUser = await prisma.user.findFirst({
        where: { email, shopId },
      });

      if (existingUser) {
        if (!existingUser.isActive) {
          logSecurityEvent("google_login_failed", {
            reason: "inactive_user",
            userId: existingUser.id,
          });
          return false;
        }

        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: existingUser.emailVerified || new Date(),
            image: existingUser.image || user.image,
          },
        });

        return true;
      }

      try {
        await prisma.user.create({
          data: {
            shopId,
            name: user.name || email.split("@")[0],
            email,
            image: user.image,
            role: "CUSTOMER",
            isActive: true,
            emailVerified: new Date(),
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error, "email")) {
          logSecurityEvent("google_login_failed", {
            reason: "email_unique_constraint",
            email,
            shopId,
          });
          return false;
        }

        throw error;
      }

      return true;
    },

    async jwt(params) {
      const token = authConfig.callbacks?.jwt
        ? await authConfig.callbacks.jwt(params)
        : params.token;

      if (params.account?.provider === "google" && params.user?.email) {
        const email = normalizeIdentityEmail(params.user.email);
        const shopId = await getAuthShopIdWithFallback(
          "google_jwt_getCurrentShopId_failed"
        );
        const user = await prisma.user.findFirst({
          where: { email, shopId },
        });

        if (user) {
          token.id = user.id;
          token.role = user.role;
          token.active = user.isActive;
          token.shopId = user.shopId;
        }
      }

      return token;
    },
  },

  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
});
