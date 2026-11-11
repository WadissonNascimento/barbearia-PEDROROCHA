"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

const searchSchema = z.object({ query: z.string().trim().max(120).default(""), page: z.number().int().min(1).max(100000).default(1) });

export async function searchRecurringCustomersAction(input: unknown) {
  const { shopId } = await requireTenantSession({ roles: SHOP_ADMIN_ROLES });
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Confira o nome, telefone ou e-mail da busca." };
  const take = 20;
  const skip = (parsed.data.page - 1) * take;
  const query = parsed.data.query;
  const where = {
    shopId,
    role: "CUSTOMER" as const,
    isActive: true,
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { email: { contains: query, mode: "insensitive" as const } }, { phone: { contains: query } }] } : {}),
  };
  const [customers, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, phone: true, vipSubscriptions: { where: { status: "ACTIVE" }, include: { plan: { select: { code: true, name: true } } }, take: 1 } }, orderBy: [{ name: "asc" }, { createdAt: "desc" }], skip, take }),
    prisma.user.count({ where }),
  ]);
  return { ok: true as const, data: { customers: customers.map((customer) => ({ id: customer.id, name: customer.name || "Cliente", email: customer.email, phone: customer.phone, vipPlan: customer.vipSubscriptions[0]?.plan || null })), page: parsed.data.page, total, hasMore: skip + customers.length < total } };
}
