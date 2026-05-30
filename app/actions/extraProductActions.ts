"use server";

import { ExtraCategory } from "@prisma/client";
import { registerExtraStockMovement } from "@/lib/extraInventory";
import { prisma } from "@/lib/prisma";
import { isExtraCategoryValue } from "@/lib/extraCategories";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { revalidatePath } from "next/cache";
import {
  deleteExtraProductImage,
  normalizeProductImageUrl,
  uploadExtraProductImage,
} from "@/lib/extraProductImages";
import { notifyAdminsLowStockExtras } from "@/lib/appNotifications";

async function ensureExtraAccess() {
  const { user } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return user;
}

function revalidateExtraViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/extras");
  revalidatePath("/agendar");
  revalidatePath("/customer/agendamentos");
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");
}

function parseExtraCategory(value: string) {
  return isExtraCategoryValue(value) ? value : ExtraCategory.OTHER;
}

function parseCommissionFields(formData: FormData) {
  const commissionType =
    String(formData.get("commissionType") || "PERCENT") === "FIXED" ? "FIXED" : "PERCENT";
  const commissionValue = Number(formData.get("commissionValue") || 0);

  if (
    !Number.isFinite(commissionValue) ||
    commissionValue < 0 ||
    (commissionType === "PERCENT" && commissionValue > 100)
  ) {
    throw new Error("Preencha a comissao do extra corretamente.");
  }

  return {
    commissionType,
    commissionValue,
  };
}

export async function createExtraProductFromForm(formData: FormData) {
  const admin = await ensureExtraAccess();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = parseExtraCategory(String(formData.get("category") || ""));
  const price = Number(formData.get("price") || 0);
  const stock = Number(formData.get("stock") || 0);
  const commission = parseCommissionFields(formData);
  const imageFile = formData.get("image");

  if (
    !name ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    throw new Error("Preencha nome, preco e estoque corretamente.");
  }

  const extra = await prisma.extraProduct.create({
    data: {
      shopId: admin.shopId || undefined,
      name,
      description: description || null,
      category,
      price,
      stock,
      commissionType: commission.commissionType,
      commissionValue: commission.commissionValue,
    },
  });

  try {
    if (imageFile instanceof File && imageFile.size > 0) {
      const image = await uploadExtraProductImage({
        extraProductId: extra.id,
        shopId: admin.shopId,
        file: imageFile,
      });

      await prisma.extraProduct.update({
        where: { id: extra.id },
        data: {
          imageUrl: image.imageUrl,
          imagePath: image.imagePath,
        },
      });
    }

    if (stock > 0) {
      await registerExtraStockMovement({
        shopId: admin.shopId || undefined,
        extraProductId: extra.id,
        type: "IN",
        quantity: stock,
        reason: "Cadastro inicial do extra",
      });
    }
  } catch (error) {
    await prisma.extraProduct.delete({ where: { id: extra.id } }).catch(() => undefined);
    throw error;
  }

  revalidateExtraViews();
  return {
    id: extra.id,
  };
}

export async function updateExtraProductFromForm(formData: FormData) {
  await ensureExtraAccess();

  const extraProductId = String(formData.get("extraProductId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = parseExtraCategory(String(formData.get("category") || ""));
  const price = Number(formData.get("price") || 0);
  const stock = Number(formData.get("stock") || 0);
  const commission = parseCommissionFields(formData);

  if (
    !extraProductId ||
    !name ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    throw new Error("Preencha nome, categoria, preco e estoque corretamente.");
  }

  const currentExtra = await prisma.extraProduct.findUnique({
    where: { id: extraProductId },
    select: {
      stock: true,
    },
  });

  if (!currentExtra) {
    throw new Error("Extra nao encontrado.");
  }

  await prisma.extraProduct.update({
    where: { id: extraProductId },
    data: {
      name,
      description: description || null,
      category,
      price,
      stock,
      commissionType: commission.commissionType,
      commissionValue: commission.commissionValue,
    },
  });

  if (stock !== currentExtra.stock) {
    const difference = stock - currentExtra.stock;
    await registerExtraStockMovement({
      extraProductId,
      type: difference > 0 ? "ADJUST_IN" : "ADJUST_OUT",
      quantity: Math.abs(difference),
      reason: "Ajuste manual de estoque",
    });

    if (stock <= 3) {
      const updatedExtra = await prisma.extraProduct.findUnique({
        where: { id: extraProductId },
        select: {
          shopId: true,
        },
      });

      if (updatedExtra?.shopId) {
        await notifyAdminsLowStockExtras({ shopId: updatedExtra.shopId });
      }
    }
  }

  revalidateExtraViews();
  return {
    message: "Extra atualizado com sucesso.",
  };
}

export async function updateExtraProductImage(formData: FormData) {
  const admin = await ensureExtraAccess();

  const extraProductId = String(formData.get("extraProductId") || "");
  const imageFile = formData.get("image");

  if (!extraProductId || !(imageFile instanceof File) || imageFile.size === 0) {
    throw new Error("Selecione uma imagem para enviar.");
  }

  const currentExtra = await prisma.extraProduct.findUnique({
    where: { id: extraProductId },
    select: {
      id: true,
      imagePath: true,
    },
  });

  if (!currentExtra) {
    throw new Error("Extra nao encontrado.");
  }

  const image = await uploadExtraProductImage({
    extraProductId: currentExtra.id,
    shopId: admin.shopId,
    file: imageFile,
  });

  try {
    await prisma.extraProduct.update({
      where: { id: extraProductId },
      data: {
        imageUrl: image.imageUrl,
        imagePath: image.imagePath,
      },
    });
  } catch (error) {
    await deleteExtraProductImage(image.imagePath);
    throw error;
  }

  await deleteExtraProductImage(currentExtra.imagePath);
  revalidateExtraViews();

  return image;
}

export async function toggleExtraProduct(id: string) {
  await ensureExtraAccess();

  const extra = await prisma.extraProduct.findUnique({ where: { id } });

  if (!extra) {
    throw new Error("Extra nao encontrado.");
  }

  const updatedExtra = await prisma.extraProduct.update({
    where: { id },
    data: {
      isActive: !extra.isActive,
    },
  });

  revalidateExtraViews();
  return {
    id: updatedExtra.id,
    isActive: updatedExtra.isActive,
  };
}

export async function deleteExtraProduct(id: string) {
  await ensureExtraAccess();

  const extra = await prisma.extraProduct.findUnique({
    where: { id },
    select: {
      id: true,
      isActive: true,
      imagePath: true,
      _count: {
        select: {
          appointmentItems: true,
          stockMovements: true,
        },
      },
    },
  });

  if (!extra) {
    throw new Error("Extra nao encontrado.");
  }

  if (extra._count.appointmentItems > 0 || extra._count.stockMovements > 0) {
    await prisma.extraProduct.update({
      where: { id },
      data: {
        isActive: false,
        imageUrl: null,
        imagePath: null,
      },
    });

    await deleteExtraProductImage(extra.imagePath);
    revalidateExtraViews();
    return {
      deleted: false,
      message: extra.isActive
        ? "Extra ocultado para preservar historico de entregas e estoque."
        : "Extra ja estava oculto. Historico preservado.",
    };
  }

  await prisma.extraProduct.delete({
    where: { id },
  });

  await deleteExtraProductImage(extra.imagePath);
  revalidateExtraViews();
  return {
    deleted: true,
    message: "Extra excluido com sucesso.",
  };
}

export async function normalizeExtraProductImageUrl(url: string | null | undefined) {
  return normalizeProductImageUrl(url);
}
