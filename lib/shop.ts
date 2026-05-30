import { cache as reactCache } from "react";
import { headers } from "next/headers";
import type { Shop } from "@prisma/client";
import { basePrisma } from "@/lib/prisma-core";

const cache: typeof reactCache =
  typeof reactCache === "function"
    ? reactCache
    : ((<T extends (...args: unknown[]) => unknown>(callback: T) => callback) as typeof reactCache);

export const DEFAULT_SHOP_ID = "shop_jak_barber";
export const DEFAULT_SHOP_SLUG = "jak-barber";
export const UNCONFIGURED_SHOP_ID = "__unconfigured_shop__";

const UNCONFIGURED_SHOP_CONFIG: ShopRuntimeConfig = {
  id: UNCONFIGURED_SHOP_ID,
  name: "Loja nao configurada",
  slug: "loja-nao-configurada",
  primaryDomain: null,
  isDefault: false,
  isActive: false,
  metadataTitle: "Loja nao configurada",
  metadataDescription: "Esta loja ainda nao foi configurada para este dominio.",
  whatsappNumber: null,
  instagramUrl: null,
  addressLine: null,
  businessHours: null,
  logoPath: null,
  faviconPath: null,
  brandColor: "#0ea5e9",
  brandColorStrong: "#7dd3fc",
  brandColorMuted: "rgba(14, 165, 233, 0.18)",
  backgroundColor: "#030712",
  textColor: "#f6f7fb",
  fontStyle: "modern",
  designTemplate: "dark-premium",
  heroImageUrl: null,
  heroEyebrow: "Barbearia premium",
  heroTitle: "Seu estilo comeca aqui.",
  heroSubtitle: "Agende seu horario com praticidade e tenha uma experiencia premium.",
  primaryCtaLabel: "Agendar horario",
  secondaryCtaLabel: "Ver servicos",
  secondaryCtaHref: "/servicos",
  attendanceText: "Com hora marcada",
  reviewsTitle: "O que os clientes acharam.",
  reviewsEmptyText:
    "As avaliacoes reais dos clientes vao aparecer aqui depois dos atendimentos concluidos.",
};

export type ShopRuntimeConfig = Pick<
  Shop,
  | "id"
  | "name"
  | "slug"
  | "primaryDomain"
  | "isDefault"
  | "isActive"
  | "metadataTitle"
  | "metadataDescription"
  | "whatsappNumber"
  | "instagramUrl"
  | "addressLine"
  | "businessHours"
  | "logoPath"
  | "faviconPath"
  | "brandColor"
  | "brandColorStrong"
  | "brandColorMuted"
  | "backgroundColor"
  | "textColor"
  | "fontStyle"
  | "designTemplate"
  | "heroImageUrl"
  | "heroEyebrow"
  | "heroTitle"
  | "heroSubtitle"
  | "primaryCtaLabel"
  | "secondaryCtaLabel"
  | "secondaryCtaHref"
  | "attendanceText"
  | "reviewsTitle"
  | "reviewsEmptyText"
>;

type ShopCacheEntry = {
  expiresAt: number;
  value: ShopRuntimeConfig | null;
};

type TenantObservabilityEvent = {
  event: string;
  host?: string | null;
  path?: string | null;
  resolvedShopId?: string | null;
  usedFallback?: boolean;
  fallbackReason?: string | null;
  prismaModel?: string | null;
  prismaOperation?: string | null;
  errorName?: string | null;
  errorMessage?: string | null;
};

const SHOP_CACHE_TTL_MS = 60_000;
const shopRuntimeCache = new Map<string, ShopCacheEntry>();
const shopRuntimeSelect = {
  id: true,
  name: true,
  slug: true,
  primaryDomain: true,
  isDefault: true,
  isActive: true,
  metadataTitle: true,
  metadataDescription: true,
  whatsappNumber: true,
  instagramUrl: true,
  addressLine: true,
  businessHours: true,
  logoPath: true,
  faviconPath: true,
  brandColor: true,
  brandColorStrong: true,
  brandColorMuted: true,
  backgroundColor: true,
  textColor: true,
  fontStyle: true,
  designTemplate: true,
  heroImageUrl: true,
  heroEyebrow: true,
  heroTitle: true,
  heroSubtitle: true,
  primaryCtaLabel: true,
  secondaryCtaLabel: true,
  secondaryCtaHref: true,
  attendanceText: true,
  reviewsTitle: true,
  reviewsEmptyText: true,
} satisfies Record<keyof ShopRuntimeConfig, true>;

function normalizeHost(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase().replace(/:\d+$/, "");
}

function sanitizeLogPath(value: string | null | undefined) {
  const path = value?.trim();

  if (!path) {
    return null;
  }

  try {
    const parsed = path.startsWith("http")
      ? new URL(path)
      : new URL(path, "http://local.invalid");

    return sanitizePathSegments(parsed.pathname);
  } catch {
    return sanitizePathSegments(path.split("?")[0])?.slice(0, 160) || null;
  }
}

function isSensitivePathSegment(segment: string) {
  let decodedSegment = segment;

  try {
    decodedSegment = decodeURIComponent(segment);
  } catch {
    decodedSegment = segment;
  }

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      decodedSegment
    ) ||
    /^c[a-z0-9]{20,}$/i.test(decodedSegment) ||
    /^[a-z0-9_-]{18,}$/i.test(decodedSegment) ||
    /^\d{8,}$/.test(decodedSegment)
  );
}

function sanitizePathSegments(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  const pathname = path.split("?")[0]?.slice(0, 240) || "";
  const sanitized = pathname
    .split("/")
    .map((segment) => (isSensitivePathSegment(segment) ? ":id" : segment))
    .join("/");

  return sanitized || null;
}

function getPathFromHeaders(headerList: Headers) {
  return (
    sanitizeLogPath(headerList.get("x-pathname")) ||
    sanitizeLogPath(headerList.get("x-invoke-path")) ||
    sanitizeLogPath(headerList.get("next-url")) ||
    sanitizeLogPath(headerList.get("x-matched-path"))
  );
}

function truncateLogValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/g, "$1?[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [token]")
    .replace(/[A-Za-z0-9._~+/=-]{32,}/g, "[token]")
    .slice(0, 160);
}

export function logTenantObservabilityEvent(input: TenantObservabilityEvent) {
  const log =
    input.event === "tenant_default_fallback_used" &&
    (process.env.NODE_ENV !== "production" || isLocalHost(input.host))
      ? console.info
      : console.warn;

  log(
    "[tenant-observability]",
    JSON.stringify({
      event: input.event,
      timestamp: new Date().toISOString(),
      NODE_ENV: process.env.NODE_ENV || "unknown",
      host: input.host || null,
      path: input.path || null,
      resolvedShopId: input.resolvedShopId || null,
      usedFallback: Boolean(input.usedFallback),
      fallbackReason: input.fallbackReason || null,
      prismaModel: input.prismaModel || null,
      prismaOperation: input.prismaOperation || null,
      errorName: input.errorName || null,
      errorMessage: truncateLogValue(input.errorMessage),
    })
  );
}

function getConfiguredHost() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    process.env.APP_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      return normalizeHost(new URL(candidate).host);
    } catch {
      continue;
    }
  }

  return null;
}

function isLocalHost(host: string | null | undefined) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

export function getDomainCandidates(host: string) {
  const candidates = new Set([host]);

  if (host.startsWith("www.")) {
    candidates.add(host.slice(4));
  } else {
    candidates.add(`www.${host}`);
  }

  return [...candidates];
}

function canUseDefaultShopFallback(host: string | null) {
  if (!host) {
    return process.env.NODE_ENV !== "production";
  }

  if (process.env.NODE_ENV !== "production" || isLocalHost(host)) {
    return true;
  }

  const configuredHost = getConfiguredHost();
  return Boolean(configuredHost && getDomainCandidates(configuredHost).includes(host));
}

export async function getRequestHost() {
  try {
    const headerList = await headers();

    return (
      normalizeHost(headerList.get("x-forwarded-host")) ||
      normalizeHost(headerList.get("host")) ||
      getConfiguredHost()
    );
  } catch {
    return getConfiguredHost();
  }
}

export async function getRequestPath() {
  try {
    const headerList = await headers();

    return getPathFromHeaders(headerList);
  } catch {
    return null;
  }
}

const getShopByHost = cache(async (host: string | null): Promise<ShopRuntimeConfig | null> => {
  const cacheKey = host || "__default__";
  const now = Date.now();
  const cached = shopRuntimeCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (host) {
    const shopByDomain = await basePrisma.shop.findFirst({
      where: {
        isActive: true,
        primaryDomain: {
          in: getDomainCandidates(host),
        },
      },
      select: shopRuntimeSelect,
    });

    if (shopByDomain) {
      shopRuntimeCache.set(cacheKey, {
        expiresAt: now + SHOP_CACHE_TTL_MS,
        value: shopByDomain,
      });
      return shopByDomain;
    }

    if (!canUseDefaultShopFallback(host)) {
      shopRuntimeCache.set(cacheKey, {
        expiresAt: now + SHOP_CACHE_TTL_MS,
        value: null,
      });
      return null;
    }
  }

  const defaultShop =
    (await basePrisma.shop.findFirst({
      where: {
        isActive: true,
        isDefault: true,
      },
      select: shopRuntimeSelect,
    })) ||
    (await basePrisma.shop.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: shopRuntimeSelect,
    }));

  logTenantObservabilityEvent({
    event: "tenant_default_fallback_used",
    host,
    resolvedShopId: defaultShop?.id || null,
    usedFallback: true,
    fallbackReason: host ? "fallback_allowed_for_host" : "missing_host",
  });

  shopRuntimeCache.set(cacheKey, {
    expiresAt: now + SHOP_CACHE_TTL_MS,
    value: defaultShop,
  });

  return defaultShop;
});

export async function getCurrentShop() {
  const host = await getRequestHost();
  const path = await getRequestPath();
  const shop = await getShopByHost(host).catch((error) => {
    logTenantObservabilityEvent({
      event: "tenant_resolution_error",
      host,
      path,
      resolvedShopId: null,
      usedFallback: false,
      fallbackReason: "shop_lookup_failed",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });

    return null;
  });

  if (!shop) {
    logTenantObservabilityEvent({
      event: "tenant_unconfigured_returned",
      host,
      path,
      resolvedShopId: UNCONFIGURED_SHOP_ID,
      usedFallback: false,
      fallbackReason: "shop_not_resolved",
    });

    return UNCONFIGURED_SHOP_CONFIG;
  }

  return shop;
}

export async function getCurrentShopId() {
  const shop = await getCurrentShop();
  return shop.id;
}

export function clearShopRuntimeCache() {
  shopRuntimeCache.clear();
}
