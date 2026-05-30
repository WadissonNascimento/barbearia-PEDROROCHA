"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clearShopRuntimeCache } from "@/lib/shop";
import { sanitizeEmailInput, sanitizeTextInput } from "@/lib/inputSanitization";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import {
  isValidBrazilianPhone,
  normalizeBrazilianPhoneForSubmit,
} from "@/lib/phone";

type ActionResult = {
  ok: boolean;
  message: string;
  tone: "success" | "error" | "info";
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireAdminShop() {
  const { shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return {
    shopId,
  };
}

function normalizeOptionalEmail(formData: FormData, key: string) {
  const value = sanitizeEmailInput(formData.get(key)?.toString());

  if (!value) {
    return null;
  }

  if (!EMAIL_PATTERN.test(value)) {
    throw new Error("Informe um e-mail valido.");
  }

  return value;
}

function normalizeInstagram(value: string | null | undefined) {
  const cleaned = sanitizeTextInput(value, { maxLength: 160 });

  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("@")) {
    const handle = cleaned.slice(1).replace(/[^a-zA-Z0-9._]/g, "");
    return handle ? `https://instagram.com/${handle}` : null;
  }

  if (!cleaned.includes("/") && !cleaned.includes(".")) {
    const handle = cleaned.replace(/[^a-zA-Z0-9._]/g, "");
    return handle ? `https://instagram.com/${handle}` : null;
  }

  try {
    const url = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Protocolo invalido.");
    }

    return url.toString();
  } catch {
    throw new Error("Informe um Instagram valido, como @perfil ou link completo.");
  }
}

function revalidateShopSettingsViews() {
  revalidatePath("/");
  revalidatePath("/agendar");
  revalidatePath("/maquinas");
  revalidatePath("/produtos");
  revalidatePath("/admin");
  revalidatePath("/admin/home");
  revalidatePath("/admin/configuracoes");
}

export async function updateAdminShopSettingsAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdminShop();
    const rawWhatsapp = formData.get("whatsappNumber")?.toString() || "";
    const whatsappNumber = rawWhatsapp.trim()
      ? normalizeBrazilianPhoneForSubmit(rawWhatsapp)
      : null;
    const instagramUrl = normalizeInstagram(
      formData.get("instagramUrl")?.toString()
    );
    const replyToEmail = normalizeOptionalEmail(formData, "replyToEmail");

    if (rawWhatsapp.trim() && !isValidBrazilianPhone(whatsappNumber)) {
      return {
        ok: false,
        tone: "error",
        message: "Informe um WhatsApp valido no formato (11) 96590-0713.",
      };
    }

    await prisma.$transaction([
      prisma.shop.update({
        where: {
          id: admin.shopId,
        },
        data: {
          whatsappNumber,
          instagramUrl,
        },
      }),
      prisma.shopEmailSettings.upsert({
        where: {
          shopId: admin.shopId,
        },
        create: {
          shopId: admin.shopId,
          replyToEmail,
        },
        update: {
          replyToEmail,
        },
      }),
    ]);

    clearShopRuntimeCache();
    revalidateShopSettingsViews();

    return {
      ok: true,
      tone: "success",
      message: "Configuracoes da barbearia atualizadas.",
    };
  } catch (error) {
    return {
      ok: false,
      tone: "error",
      message:
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar as configuracoes.",
    };
  }
}
