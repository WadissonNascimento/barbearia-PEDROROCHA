import { NextRequest } from "next/server";
import { handlers } from "@/auth";

function getFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function isLocalHost(value: string | null | undefined) {
  const host = getFirstHeaderValue(value || "").toLowerCase();

  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("[::1]:")
  );
}

function normalizePublicHost(value: string | null | undefined) {
  const host = getFirstHeaderValue(value || "");

  if (!host || isLocalHost(host)) {
    return host;
  }

  return host.replace(/:3000$/, "");
}

function getPublicHost(headers: Headers, requestUrl: URL) {
  const host = normalizePublicHost(headers.get("host"));
  const forwardedHost = normalizePublicHost(headers.get("x-forwarded-host"));
  const requestHost = normalizePublicHost(requestUrl.host);

  if (host && !isLocalHost(host)) {
    return host;
  }

  if (forwardedHost && !isLocalHost(forwardedHost)) {
    return forwardedHost;
  }

  if (requestHost && !isLocalHost(requestHost)) {
    return requestHost;
  }

  return host || forwardedHost || requestHost || requestUrl.host;
}

function hostHasExplicitPort(host: string) {
  return /:\d+$/.test(host);
}

function applyPublicUrlHost(url: URL, publicHost: string) {
  url.host = publicHost;

  if (!isLocalHost(publicHost) && !hostHasExplicitPort(publicHost)) {
    url.port = "";
  }
}

function normalizeAuthRequest(request: NextRequest) {
  const headers = new Headers(request.headers);
  const url = new URL(request.url);
  const publicHost = getPublicHost(headers, url);
  const forwardedProto = getFirstHeaderValue(headers.get("x-forwarded-proto"));
  const publicProto =
    forwardedProto && forwardedProto !== "http"
      ? forwardedProto
      : isLocalHost(publicHost)
        ? url.protocol.replace(":", "")
        : "https";

  if (publicHost) {
    headers.set("host", publicHost);
    headers.set("x-forwarded-host", publicHost);
    applyPublicUrlHost(url, publicHost);
  }

  headers.set("x-forwarded-proto", publicProto);
  url.protocol = `${publicProto}:`;

  if (publicHost && !isLocalHost(publicHost) && !hostHasExplicitPort(publicHost)) {
    url.port = "";
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  return new NextRequest(url, init as never);
}

export function GET(request: NextRequest) {
  return handlers.GET(normalizeAuthRequest(request));
}

export function POST(request: NextRequest) {
  return handlers.POST(normalizeAuthRequest(request));
}
