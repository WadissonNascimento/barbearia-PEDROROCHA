import { prisma } from "@/lib/prisma";
import { DEFAULT_SHOP_ID } from "@/lib/shop";

export const ADMIN_BARBER_PROFILE = {
  name: "Jackson Barber",
  email: "jackson.barber@jakbarber.local",
  image: "/uploads/barbers/jackson-barber.jpg",
};

export const SHOPS_WITHOUT_ADMIN_BARBER_PROFILE = new Set([
  "shop_pedro_rocha_barbearia",
]);

export function canAdminActAsBarber(shopId?: string | null) {
  const targetShopId = shopId || DEFAULT_SHOP_ID;

  return !SHOPS_WITHOUT_ADMIN_BARBER_PROFILE.has(targetShopId);
}

function getAdminBarberProfile(shopId: string) {
  if (shopId === DEFAULT_SHOP_ID) {
    return ADMIN_BARBER_PROFILE;
  }

  return {
    name: "Barbeiro da equipe",
    email: `admin-barber+${shopId}@local.invalid`,
    image: null,
  };
}

const activeBarberSelect = {
  id: true,
  shopId: true,
  name: true,
  email: true,
  phone: true,
  image: true,
  role: true,
  isActive: true,
  shop: {
    select: {
      name: true,
    },
  },
} as const;

type SessionUserLike = {
  id: string;
  role?: string | null;
  shopId?: string | null;
};

export async function ensureAdminBarberProfile(shopId?: string | null) {
  const targetShopId = shopId || DEFAULT_SHOP_ID;

  if (!canAdminActAsBarber(targetShopId)) {
    return null;
  }

  const profile = getAdminBarberProfile(targetShopId);
  const existingByDefaultEmail = await prisma.user.findFirst({
    where: {
      shopId: targetShopId,
      role: "BARBER",
      email: profile.email,
    },
    select: activeBarberSelect,
  });
  const existing =
    existingByDefaultEmail ||
    (await prisma.user.findFirst({
      where: {
        shopId: targetShopId,
        role: "BARBER",
        OR: [
          { name: profile.name },
          ...(profile.image ? [{ image: profile.image }] : []),
        ],
      },
      select: activeBarberSelect,
      orderBy: {
        createdAt: "asc",
      },
    }));

  if (existing && existing.role === "BARBER" && existing.isActive) {
    return existing;
  }

  if (existing) {
    return prisma.user.update({
      where: {
        id: existing.id,
      },
      data: {
        shopId: targetShopId,
        name: existing.name || profile.name,
        role: "BARBER",
        isActive: true,
        image: existing.image || profile.image,
      },
      select: activeBarberSelect,
    });
  }

  return prisma.user.create({
    data: {
      shopId: targetShopId,
      name: profile.name,
      email: profile.email,
      role: "BARBER",
      isActive: true,
      image: profile.image,
    },
    select: activeBarberSelect,
  });
}

export async function getActiveBarberForSession(user: SessionUserLike) {
  if (user.role === "ADMIN" || user.role === "SHOP_ADMIN") {
    if (!canAdminActAsBarber(user.shopId)) {
      return null;
    }

    return ensureAdminBarberProfile(user.shopId);
  }

  if (user.role !== "BARBER") {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: user.id,
      role: "BARBER",
      isActive: true,
    },
    select: activeBarberSelect,
  });
}
