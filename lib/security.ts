import { createHash } from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/prisma-core";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type SecurityEventDetails = Record<
  string,
  string | number | boolean | null | undefined
>;

const buckets = new Map<string, RateLimitBucket>();
const usePersistentRateLimit =
  process.env.RATE_LIMIT_STORE !== "memory" &&
  process.env.NODE_ENV === "production";

function sanitizeLogDetails(details: SecurityEventDetails = {}) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, 120) : value,
    ])
  );
}

export function logSecurityEvent(
  event: string,
  details: SecurityEventDetails = {}
) {
  console.warn(
    `[security] ${event}`,
    JSON.stringify({
      at: new Date().toISOString(),
      ...sanitizeLogDetails(details),
    })
  );
}

export function getClientIp(headerList: Headers) {
  const forwardedFor = headerList.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    headerList.get("cf-connecting-ip") ||
    headerList.get("x-real-ip") ||
    forwardedIp ||
    "unknown"
  );
}

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 1000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export async function checkRateLimit({
  key,
  scope = "general",
  limit,
  windowMs,
}: {
  key: string;
  scope?: string;
  limit: number;
  windowMs: number;
}) {
  if (usePersistentRateLimit) {
    try {
      return await checkPersistentRateLimit({ key, scope, limit, windowMs });
    } catch (error) {
      logSecurityEvent("rate_limit_store_failed", {
        scope,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return checkMemoryRateLimit({ key, limit, windowMs });
}

async function checkPersistentRateLimit({
  key,
  scope,
  limit,
  windowMs,
}: {
  key: string;
  scope: string;
  limit: number;
  windowMs: number;
}) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const keyHash = createHash("sha256").update(key).digest("hex");

  const rows = await basePrisma.$queryRaw<
    Array<{ count: number; resetAt: Date }>
  >`
    INSERT INTO "RateLimitBucket" ("id", "keyHash", "scope", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${keyHash}, ${keyHash}, ${scope}, 1, ${resetAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("keyHash") DO UPDATE
    SET
      "scope" = EXCLUDED."scope",
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."resetAt"
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count", "resetAt"
  `;

  if (Math.random() < 0.01) {
    await basePrisma.rateLimitBucket
      .deleteMany({
        where: {
          resetAt: {
            lt: now,
          },
        },
      })
      .catch(() => null);
  }

  const bucket = rows[0];
  const count = bucket?.count ?? limit + 1;
  const bucketResetAt = bucket?.resetAt?.getTime() ?? resetAt.getTime();

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: bucketResetAt,
  };
}

async function checkMemoryRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export async function enforceRateLimit({
  scope,
  identifier,
  limit,
  windowMs,
}: {
  scope: string;
  identifier?: string;
  limit: number;
  windowMs: number;
}) {
  const headerList = await headers();
  const ip = getClientIp(headerList);
  const safeIdentifier = (identifier || "anonymous").trim().toLowerCase();
  const key = `${scope}:${ip}:${safeIdentifier}`;
  const result = await checkRateLimit({ key, scope, limit, windowMs });

  if (!result.allowed) {
    logSecurityEvent("rate_limit", {
      scope,
      ip,
      identifier: safeIdentifier,
      resetAt: new Date(result.resetAt).toISOString(),
    });
  }

  return result;
}

export async function readJsonWithLimit<T = unknown>(
  request: Request,
  maxBytes = 16 * 1024
): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > maxBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  return JSON.parse(text) as T;
}

export function rateLimitResponse(message = "Muitas tentativas. Tente novamente em instantes.") {
  return NextResponse.json({ message }, { status: 429 });
}

