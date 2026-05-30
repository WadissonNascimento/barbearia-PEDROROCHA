import { NextResponse } from "next/server";
import { z } from "zod";
import { basePrisma } from "@/lib/prisma-core";
import {
  BARBER_ROLES,
  CUSTOMER_ROLES,
  getTenantSession,
  SHOP_ADMIN_ROLES,
} from "@/lib/tenantSession";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(400).optional().nullable(),
});

function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
  );
}

async function getAuthenticatedUser() {
  const tenantSession = await getTenantSession({
    roles: [...SHOP_ADMIN_ROLES, ...BARBER_ROLES, ...CUSTOMER_ROLES],
  });

  if (!tenantSession) {
    return null;
  }
  const { session, shopId } = tenantSession;

  return basePrisma.user.findFirst({
    where: {
      id: session.user.id,
      shopId,
      isActive: true,
      role: {
        in: [...SHOP_ADMIN_ROLES, ...BARBER_ROLES, ...CUSTOMER_ROLES],
      },
    },
    select: {
      id: true,
      shopId: true,
    },
  });
}

export async function POST(request: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { ok: false, error: "push_not_configured" },
      { status: 503 }
    );
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = pushSubscriptionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_subscription" },
      { status: 400 }
    );
  }

  const subscription = parsed.data;

  await basePrisma.pushSubscription.upsert({
    where: {
      endpoint: subscription.endpoint,
    },
    create: {
      shopId: user.shopId,
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: subscription.userAgent || null,
      isActive: true,
      failureCount: 0,
    },
    update: {
      shopId: user.shopId,
      userId: user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: subscription.userAgent || null,
      isActive: true,
      failureCount: 0,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = z
    .object({
      endpoint: z.string().url(),
    })
    .safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_subscription" },
      { status: 400 }
    );
  }

  await basePrisma.pushSubscription.updateMany({
    where: {
      shopId: user.shopId,
      userId: user.id,
      endpoint: parsed.data.endpoint,
    },
    data: {
      isActive: false,
    },
  });

  return NextResponse.json({ ok: true });
}
