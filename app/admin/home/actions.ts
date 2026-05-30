"use server";

import { revalidatePath } from "next/cache";
import { deleteHomeImage, uploadHomeImage } from "@/lib/homeImages";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";

const MAX_ACTIVE_HOME_IMAGES = 5;

async function ensureHomeImageAdmin() {
  const { user, shopId } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return {
    id: user.id,
    shopId,
  };
}

function revalidateHomeImageViews() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/home");
}

async function getNextHomeImagePosition(shopId: string) {
  const latestImage = await prisma.homeImage.findFirst({
    where: {
      shopId,
      isActive: true,
    },
    orderBy: {
      position: "desc",
    },
    select: {
      position: true,
    },
  });

  return Math.min((latestImage?.position ?? -1) + 1, MAX_ACTIVE_HOME_IMAGES - 1);
}

async function normalizeHomeImagePositions(shopId: string) {
  const images = await prisma.homeImage.findMany({
    where: {
      shopId,
      isActive: true,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
    },
    take: MAX_ACTIVE_HOME_IMAGES,
  });

  await prisma.$transaction(
    images.map((image, index) =>
      prisma.homeImage.update({
        where: { id: image.id },
        data: { position: index },
      })
    )
  );
}

export async function uploadHomeImageAction(formData: FormData) {
  const admin = await ensureHomeImageAdmin();
  const shopId = admin.shopId;
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione uma imagem para enviar.");
  }

  const activeCount = await prisma.homeImage.count({
    where: {
      shopId,
      isActive: true,
    },
  });

  if (activeCount >= MAX_ACTIVE_HOME_IMAGES) {
    throw new Error("A home pode ter no maximo 5 fotos ativas.");
  }

  const uploaded = await uploadHomeImage(file, shopId);

  try {
    await prisma.homeImage.create({
      data: {
        shopId,
        imageUrl: uploaded.imageUrl,
        imagePath: uploaded.imagePath,
        position: await getNextHomeImagePosition(shopId),
      },
    });
  } catch (error) {
    await deleteHomeImage(uploaded.imagePath);
    throw error;
  }

  revalidateHomeImageViews();
  return { message: "Foto enviada para a home." };
}

export async function replaceHomeImageAction(formData: FormData) {
  const admin = await ensureHomeImageAdmin();
  const shopId = admin.shopId;
  const imageId = String(formData.get("imageId") || "").trim();
  const file = formData.get("image");

  if (!imageId) {
    throw new Error("Foto nao encontrada.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione uma imagem para substituir.");
  }

  const currentImage = await prisma.homeImage.findFirst({
    where: {
      id: imageId,
      shopId,
    },
  });

  if (!currentImage) {
    throw new Error("Foto nao encontrada.");
  }

  const uploaded = await uploadHomeImage(file, shopId);

  try {
    await prisma.homeImage.update({
      where: { id: currentImage.id },
      data: {
        imageUrl: uploaded.imageUrl,
        imagePath: uploaded.imagePath,
        isActive: true,
      },
    });
  } catch (error) {
    await deleteHomeImage(uploaded.imagePath);
    throw error;
  }

  await deleteHomeImage(currentImage.imagePath);
  revalidateHomeImageViews();
  return { message: "Foto substituida com sucesso." };
}

export async function removeHomeImageAction(formData: FormData) {
  const admin = await ensureHomeImageAdmin();
  const shopId = admin.shopId;
  const imageId = String(formData.get("imageId") || "").trim();

  if (!imageId) {
    throw new Error("Foto nao encontrada.");
  }

  const currentImage = await prisma.homeImage.findFirst({
    where: {
      id: imageId,
      shopId,
    },
  });

  if (!currentImage) {
    throw new Error("Foto nao encontrada.");
  }

  await prisma.homeImage.delete({
    where: {
      id: currentImage.id,
    },
  });
  await deleteHomeImage(currentImage.imagePath);
  await normalizeHomeImagePositions(shopId);

  revalidateHomeImageViews();
  return { message: "Foto removida da home." };
}

export async function reorderHomeImageAction(formData: FormData) {
  const admin = await ensureHomeImageAdmin();
  const shopId = admin.shopId;
  const imageId = String(formData.get("imageId") || "").trim();
  const direction = String(formData.get("direction") || "");

  if (!imageId || !["up", "down"].includes(direction)) {
    throw new Error("Ordem invalida.");
  }

  const images = await prisma.homeImage.findMany({
    where: {
      shopId,
      isActive: true,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    take: MAX_ACTIVE_HOME_IMAGES,
  });
  const currentIndex = images.findIndex((image) => image.id === imageId);

  if (currentIndex === -1) {
    throw new Error("Foto nao encontrada.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= images.length) {
    return { message: "Ordem mantida." };
  }

  const nextImages = [...images];
  const [currentImage] = nextImages.splice(currentIndex, 1);
  nextImages.splice(targetIndex, 0, currentImage);

  await prisma.$transaction(
    nextImages.map((image, index) =>
      prisma.homeImage.update({
        where: { id: image.id },
        data: { position: index },
      })
    )
  );

  revalidateHomeImageViews();
  return { message: "Ordem atualizada." };
}
