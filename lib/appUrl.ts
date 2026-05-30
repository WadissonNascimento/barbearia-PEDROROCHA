function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

type AppUrlShop = {
  primaryDomain?: string | null;
};

export function getConfiguredAppUrl() {
  return trimTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.AUTH_URL ||
      "http://localhost:3000"
  );
}

function normalizeShopDomain(value: string) {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function stripHostPort(host: string) {
  return host.toLowerCase().replace(/:\d+$/, "");
}

function isLocalDomain(host: string) {
  const hostname = stripHostPort(host);

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function getDomainCandidates(host: string) {
  const normalizedHost = stripHostPort(host);
  const candidates = new Set([normalizedHost]);

  if (normalizedHost.startsWith("www.")) {
    candidates.add(normalizedHost.slice(4));
  } else {
    candidates.add(`www.${normalizedHost}`);
  }

  return candidates;
}

export function getShopAppUrl(shop?: AppUrlShop | null) {
  const domain = shop?.primaryDomain?.trim();

  if (!domain) {
    return getConfiguredAppUrl();
  }

  const normalizedDomain = normalizeShopDomain(domain);
  const protocol = isLocalDomain(normalizedDomain) ? "http" : "https";

  return trimTrailingSlash(`${protocol}://${normalizedDomain}`);
}

export async function getCurrentRequestAppUrl() {
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const forwardedHost = getFirstHeaderValue(headerList.get("x-forwarded-host"));
    const host = forwardedHost || getFirstHeaderValue(headerList.get("host"));

    if (!host) {
      return null;
    }

    const proto =
      normalizeRequestProto(headerList.get("x-forwarded-proto")) ||
      (isLocalDomain(host) ? "http" : "https");

    return trimTrailingSlash(`${proto}://${host}`);
  } catch {
    return null;
  }
}

export async function getCurrentShopAppUrl() {
  const { getCurrentShop } = await import("@/lib/shop");
  const [requestAppUrl, shop] = await Promise.all([
    getCurrentRequestAppUrl(),
    getCurrentShop().catch(() => null),
  ]);

  if (requestAppUrl) {
    const requestHost = new URL(requestAppUrl).host;
    const shopDomain = shop?.primaryDomain
      ? normalizeShopDomain(shop.primaryDomain)
      : "";
    const requestDomainCandidates = getDomainCandidates(requestHost);

    if (
      process.env.NODE_ENV !== "production" ||
      !shopDomain ||
      requestDomainCandidates.has(stripHostPort(shopDomain))
    ) {
      return requestAppUrl;
    }
  }

  return getShopAppUrl(shop);
}

function getFirstHeaderValue(value: string | null | undefined) {
  return value?.split(",")[0]?.trim() || "";
}

function normalizeRequestProto(value: string | null | undefined) {
  const proto = getFirstHeaderValue(value).toLowerCase();

  return proto === "http" || proto === "https" ? proto : "";
}

export function getRequestAwareAppUrl(
  requestUrl: string,
  requestHeaders?: Headers
) {
  const parsedUrl = new URL(requestUrl);
  const forwardedHost = getFirstHeaderValue(
    requestHeaders?.get("x-forwarded-host")
  );
  const host = forwardedHost || getFirstHeaderValue(requestHeaders?.get("host"));

  if (host) {
    const proto =
      normalizeRequestProto(requestHeaders?.get("x-forwarded-proto")) ||
      parsedUrl.protocol.replace(":", "");

    return trimTrailingSlash(`${proto}://${host}`);
  }

  return trimTrailingSlash(parsedUrl.origin);
}
