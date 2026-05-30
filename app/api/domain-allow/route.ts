import { NextRequest, NextResponse } from "next/server";
import { getDomainCandidates } from "@/lib/shop";
import { normalizeDomainInput, isLocalOrReservedDomain } from "@/lib/domainReadiness";
import { basePrisma } from "@/lib/prisma-core";

export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getRequestedDomain(request: NextRequest) {
  return normalizeDomainInput(
    request.nextUrl.searchParams.get("domain") ||
      request.nextUrl.searchParams.get("host") ||
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host")
  );
}

export async function GET(request: NextRequest) {
  const domain = getRequestedDomain(request);

  if (!domain || isLocalOrReservedDomain(domain)) {
    return jsonResponse({ ok: false, reason: "invalid_or_reserved_domain" }, 404);
  }

  const shop = await basePrisma.shop.findFirst({
    where: {
      isActive: true,
      primaryDomain: {
        in: getDomainCandidates(domain),
      },
    },
    select: {
      id: true,
      slug: true,
      primaryDomain: true,
    },
  });

  if (!shop) {
    return jsonResponse({ ok: false, reason: "domain_not_allowed", domain }, 404);
  }

  return jsonResponse(
    {
      ok: true,
      type: "shop",
      domain,
      shopId: shop.id,
      shopSlug: shop.slug,
      primaryDomain: shop.primaryDomain,
    },
    200
  );
}

export const HEAD = GET;
