import { auth } from "@/auth";
import {
  getCurrentShop,
  getRequestHost,
  getRequestPath,
  logTenantObservabilityEvent,
  UNCONFIGURED_SHOP_ID,
  type ShopRuntimeConfig,
} from "@/lib/shop";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

export const SHOP_ADMIN_ROLES = ["ADMIN", "SHOP_ADMIN"] as const;
export const BARBER_ROLES = ["BARBER"] as const;
export const CUSTOMER_ROLES = ["CUSTOMER"] as const;

type TenantSessionUser = Session["user"];

type RequireTenantSessionOptions = {
  roles?: readonly string[];
  loginRedirect?: string;
  forbiddenRedirect?: string;
  tenantMismatchRedirect?: string;
};

type TenantSessionResult = {
  session: Session;
  user: TenantSessionUser;
  shop: ShopRuntimeConfig;
  shopId: string;
};

type TenantSessionFailure = {
  reason: "unauthenticated" | "forbidden" | "tenant_mismatch";
  session: Session | null;
  shop: ShopRuntimeConfig;
};

function isAllowedRole(role: string | null | undefined, roles?: readonly string[]) {
  return !roles?.length || Boolean(role && roles.includes(role));
}

async function logTenantSessionMismatch({
  shop,
  user,
}: {
  shop: ShopRuntimeConfig;
  user: TenantSessionUser;
}) {
  const [host, path] = await Promise.all([
    getRequestHost().catch(() => null),
    getRequestPath().catch(() => null),
  ]);

  logTenantObservabilityEvent({
    event: "tenant_session_shop_mismatch",
    host,
    path,
    resolvedShopId: shop.id,
    usedFallback: false,
    fallbackReason: user.shopId ? "session_shop_mismatch" : "missing_session_shop",
  });
}

async function resolveTenantSession({
  roles,
}: Pick<RequireTenantSessionOptions, "roles"> = {}): Promise<
  | { ok: true; value: TenantSessionResult }
  | { ok: false; value: TenantSessionFailure }
> {
  const [session, shop] = await Promise.all([auth(), getCurrentShop()]);

  if (!session?.user?.id) {
    return {
      ok: false,
      value: {
        reason: "unauthenticated",
        session,
        shop,
      },
    };
  }

  if (!isAllowedRole(session.user.role, roles)) {
    return {
      ok: false,
      value: {
        reason: "forbidden",
        session,
        shop,
      },
    };
  }

  if (!session.user.shopId || shop.id === UNCONFIGURED_SHOP_ID || shop.id !== session.user.shopId) {
    await logTenantSessionMismatch({
      shop,
      user: session.user,
    });
    return {
      ok: false,
      value: {
        reason: "tenant_mismatch",
        session,
        shop,
      },
    };
  }

  return {
    ok: true,
    value: {
      session,
      user: session.user,
      shop,
      shopId: session.user.shopId,
    },
  };
}

export async function getTenantSession({
  roles,
}: Pick<RequireTenantSessionOptions, "roles"> = {}): Promise<TenantSessionResult | null> {
  const result = await resolveTenantSession({ roles });
  return result.ok ? result.value : null;
}

export async function requireTenantSession({
  roles,
  loginRedirect = "/login",
  forbiddenRedirect = "/painel",
  tenantMismatchRedirect = "/logout",
}: RequireTenantSessionOptions = {}): Promise<TenantSessionResult> {
  const result = await resolveTenantSession({ roles });

  if (result.ok) {
    return result.value;
  }

  if (result.value.reason === "unauthenticated") {
    redirect(loginRedirect);
  }

  if (result.value.reason === "forbidden") {
    redirect(forbiddenRedirect);
  }

  redirect(tenantMismatchRedirect);
}
