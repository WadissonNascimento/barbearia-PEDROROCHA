import { Prisma } from "@prisma/client";

export function normalizeIdentityEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function getShopEmailRateLimitIdentifier(shopId: string | null | undefined, email: string) {
  return `${shopId || "unknown"}:${normalizeIdentityEmail(email)}`;
}

export function isUniqueConstraintError(error: unknown, field?: string) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  if (!field) {
    return true;
  }

  const target = error.meta?.target;

  return Array.isArray(target) && target.includes(field);
}
