import "server-only";

import { basePrisma } from "@/lib/prisma-core";

export type ShopEmailIdentity = {
  fromName?: string;
  replyTo?: string;
  notificationEmail?: string;
};

function normalizeOptionalEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function getShopEmailIdentity(shopId: string | null | undefined) {
  if (!shopId) {
    return {};
  }

  try {
    const shop = await basePrisma.shop.findUnique({
      where: {
        id: shopId,
      },
      select: {
        name: true,
        emailSettings: {
          select: {
            fromName: true,
            replyToEmail: true,
            notificationEmail: true,
          },
        },
      },
    });

    if (!shop) {
      return {};
    }

    return {
      fromName: normalizeOptionalText(shop.emailSettings?.fromName) || normalizeOptionalText(shop.name),
      replyTo: normalizeOptionalEmail(shop.emailSettings?.replyToEmail),
      notificationEmail: normalizeOptionalEmail(shop.emailSettings?.notificationEmail),
    };
  } catch (error) {
    console.warn(
      `[email] Nao foi possivel carregar identidade de email da shop ${shopId}: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`
    );
    return {};
  }
}
