"use server";

import { ProductCategory } from "@prisma/client";
import { registerStockMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { isProductCategoryValue } from "@/lib/productCategories";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { revalidatePath } from "next/cache";
import {
  deleteProductImage,
  normalizeProductImageUrl,
  uploadProductImage,
  uploadSecondaryProductImage,
} from "@/lib/productImages";

const MAX_PRODUCT_DESCRIPTION_LENGTH = 360;
const MAX_SECONDARY_PRODUCT_IMAGES = 5;

async function ensureProductAccess() {
  const { user } = await requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });

  return user;
}

function revalidateProductViews() {
  revalidatePath("/maquinas");
  revalidatePath("/produtos");
  revalidatePath("/admin");
  revalidatePath("/admin/maquinas");
  revalidatePath("/admin/maquinas/novo");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/agendar");
  revalidatePath("/customer/agendamentos");
  revalidatePath("/barber");
  revalidatePath("/barber/agenda");
}

function parseProductCategory(value: string) {
  return isProductCategoryValue(value) ? value : ProductCategory.OTHER;
}

function parseProductDescription(value: FormDataEntryValue | null) {
  const description = String(value || "").trim();

  if (description.length > MAX_PRODUCT_DESCRIPTION_LENGTH) {
    throw new Error(
      `A descricao curta deve ter no maximo ${MAX_PRODUCT_DESCRIPTION_LENGTH} caracteres.`
    );
  }

  return description || null;
}

function getSecondaryImageFiles(formData: FormData) {
  const files = formData
    .getAll("secondaryImages")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (files.length > MAX_SECONDARY_PRODUCT_IMAGES) {
    throw new Error("Cada maquina pode ter no maximo 5 imagens secundarias.");
  }

  return files;
}

async function addSecondaryProductImages({
  productId,
  shopId,
  files,
}: {
  productId: string;
  shopId?: string | null;
  files: File[];
}) {
  if (files.length === 0) {
    return [];
  }

  const currentCount = await prisma.productImage.count({
    where: {
      productId,
      ...(shopId ? { shopId } : {}),
    },
  });

  if (currentCount + files.length > MAX_SECONDARY_PRODUCT_IMAGES) {
    throw new Error("Cada maquina pode ter no maximo 5 imagens secundarias.");
  }

  const orderInfo = await prisma.productImage.aggregate({
    where: {
      productId,
      ...(shopId ? { shopId } : {}),
    },
    _max: {
      order: true,
    },
  });
  const firstOrder = (orderInfo._max.order ?? -1) + 1;
  const createdImages: { id: string; url: string; imagePath: string | null }[] = [];
  const uploadedImages: { imageUrl: string; imagePath: string }[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const uploaded = await uploadSecondaryProductImage({
        productId,
        shopId,
        file,
      });

      uploadedImages.push(uploaded);

      const createdImage = await prisma.productImage.create({
        data: {
          shopId: shopId || undefined,
          productId,
          url: uploaded.imageUrl,
          imagePath: uploaded.imagePath,
          order: firstOrder + index,
        },
        select: {
          id: true,
          url: true,
          imagePath: true,
        },
      });

      createdImages.push(createdImage);
    }

    return createdImages;
  } catch (error) {
    await Promise.allSettled(
      createdImages.map((image) =>
        prisma.productImage.delete({ where: { id: image.id } })
      )
    );
    await Promise.allSettled(
      uploadedImages.map((image) => deleteProductImage(image.imagePath))
    );

    throw error;
  }
}

export async function createProduct(data: {
  name: string;
  description?: string;
  category?: ProductCategory;
  price: number;
  imageUrl?: string;
  stock: number;
}) {
  const admin = await ensureProductAccess();

  const name = data.name.trim();
  const price = Number(data.price);
  const stock = Number(data.stock);

  if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
    throw new Error("Preencha nome, preco e estoque corretamente.");
  }

  const product = await prisma.product.create({
    data: {
      shopId: admin.shopId || undefined,
      name,
      description: data.description?.trim() || null,
      category: data.category || ProductCategory.OTHER,
      price,
      imageUrl: normalizeProductImageUrl(data.imageUrl?.trim() || null),
      stock,
    },
  });

  await registerStockMovement({
    shopId: admin.shopId || undefined,
    productId: product.id,
    type: "IN",
    quantity: stock,
    reason: "Cadastro inicial da maquina",
  });

  revalidateProductViews();
  return product;
}

export async function addProductSecondaryImageFromForm(formData: FormData) {
  try {
    await ensureProductAccess();

    const productId = String(formData.get("productId") || "").trim();
    const imageFile = formData.get("secondaryImage");

    if (!productId || !(imageFile instanceof File) || imageFile.size === 0) {
      throw new Error("Selecione uma imagem secundaria para enviar.");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        shopId: true,
      },
    });

    if (!product) {
      throw new Error("Maquina nao encontrada.");
    }

    const [createdImage] = await addSecondaryProductImages({
      productId: product.id,
      shopId: product.shopId,
      files: [imageFile],
    });

    revalidateProductViews();

    return {
      ok: true,
      message: "Imagem secundaria adicionada.",
      image: createdImage
        ? {
            id: createdImage.id,
            url: normalizeProductImageUrl(createdImage.url) || createdImage.url,
          }
        : null,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Nao foi possivel adicionar a imagem secundaria.",
      image: null,
    };
  }
}

export async function createProductFromForm(formData: FormData) {
  const admin = await ensureProductAccess();

  const name = String(formData.get("name") || "").trim();
  const description = parseProductDescription(formData.get("description"));
  const category = parseProductCategory(String(formData.get("category") || ""));
  const price = Number(formData.get("price") || 0);
  const stock = 0;
  const imageFile = formData.get("image");
  const secondaryImageFiles = getSecondaryImageFiles(formData);

  if (
    !name ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error("Preencha nome e preco corretamente.");
  }

  const product = await prisma.product.create({
    data: {
      shopId: admin.shopId || undefined,
      name,
      description,
      category,
      price,
      stock,
    },
  });

  let imagePathToCleanup: string | null = null;
  let createdSecondaryImages: { imagePath: string | null }[] = [];

  try {
    if (imageFile instanceof File && imageFile.size > 0) {
      const image = await uploadProductImage({
        productId: product.id,
        shopId: admin.shopId,
        file: imageFile,
      });
      imagePathToCleanup = image.imagePath;

      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: image.imageUrl,
          imagePath: image.imagePath,
        },
      });
    }

    createdSecondaryImages = await addSecondaryProductImages({
      productId: product.id,
      shopId: admin.shopId,
      files: secondaryImageFiles,
    });

    if (stock > 0) {
      await registerStockMovement({
        shopId: admin.shopId || undefined,
        productId: product.id,
        type: "IN",
        quantity: stock,
        reason: "Cadastro inicial da maquina",
      });
    }
  } catch (error) {
    await deleteProductImage(imagePathToCleanup);
    await Promise.allSettled(
      createdSecondaryImages.map((image) => deleteProductImage(image.imagePath))
    );
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    throw error;
  }

  revalidateProductViews();
  return {
    id: product.id,
  };
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    category: ProductCategory;
    price: number;
    imageUrl: string | null;
    stock: number;
    isActive: boolean;
  }>
) {
  await ensureProductAccess();

  const currentProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!currentProduct) {
    throw new Error("Maquina nao encontrada.");
  }

  if (
    (typeof data.name === "string" && !data.name.trim()) ||
    (typeof data.price === "number" && (!Number.isFinite(data.price) || data.price <= 0)) ||
    (typeof data.stock === "number" &&
      (!Number.isInteger(data.stock) || data.stock < 0))
  ) {
    throw new Error("Dados de maquina invalidos.");
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      name: data.name?.trim(),
      category: data.category,
      imageUrl:
        data.imageUrl === undefined
          ? undefined
          : normalizeProductImageUrl(data.imageUrl),
    },
  });

  if (typeof data.stock === "number" && data.stock !== currentProduct.stock) {
    const difference = data.stock - currentProduct.stock;

    await registerStockMovement({
      productId: id,
      type: difference > 0 ? "ADJUST_IN" : "ADJUST_OUT",
      quantity: Math.abs(difference),
      reason: "Ajuste manual de estoque",
    });
  }

  revalidateProductViews();
  return product;
}

export async function updateProductFromForm(formData: FormData) {
  const admin = await ensureProductAccess();

  const productId = String(formData.get("productId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = parseProductDescription(formData.get("description"));
  const category = parseProductCategory(String(formData.get("category") || ""));
  const price = Number(formData.get("price") || 0);
  const imageFile = formData.get("image");
  const secondaryImageFiles = getSecondaryImageFiles(formData);

  if (
    !productId ||
    !name ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error("Preencha nome e preco corretamente.");
  }

  const currentProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      shopId: true,
      imagePath: true,
    },
  });

  if (!currentProduct) {
    throw new Error("Maquina nao encontrada.");
  }

  const image =
    imageFile instanceof File && imageFile.size > 0
      ? await uploadProductImage({
          productId: currentProduct.id,
          shopId: admin.shopId,
          file: imageFile,
        })
      : null;

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        description,
        category,
        price,
        ...(image
          ? {
              imageUrl: image.imageUrl,
              imagePath: image.imagePath,
            }
          : {}),
      },
    });

    await addSecondaryProductImages({
      productId: currentProduct.id,
      shopId: currentProduct.shopId,
      files: secondaryImageFiles,
    });
  } catch (error) {
    if (image) {
      await deleteProductImage(image.imagePath);
    }

    throw error;
  }

  if (image) {
    await deleteProductImage(currentProduct.imagePath);
  }

  revalidateProductViews();

  return {
    message: "Maquina atualizada com sucesso.",
    imageUrl: image?.imageUrl,
  };
}

export async function updateProductImage(formData: FormData) {
  const admin = await ensureProductAccess();

  const productId = String(formData.get("productId") || "");
  const imageFile = formData.get("image");

  if (!productId || !(imageFile instanceof File) || imageFile.size === 0) {
    throw new Error("Selecione uma imagem para enviar.");
  }

  const currentProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      imagePath: true,
    },
  });

  if (!currentProduct) {
    throw new Error("Maquina nao encontrada.");
  }

  const image = await uploadProductImage({
    productId: currentProduct.id,
    shopId: admin.shopId,
    file: imageFile,
  });

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        imageUrl: image.imageUrl,
        imagePath: image.imagePath,
      },
    });
  } catch (error) {
    await deleteProductImage(image.imagePath);
    throw error;
  }

  await deleteProductImage(currentProduct.imagePath);
  revalidateProductViews();

  return image;
}

export async function deleteProductSecondaryImage(formData: FormData) {
  const admin = await ensureProductAccess();
  const imageId = String(formData.get("imageId") || "").trim();

  if (!imageId) {
    throw new Error("Imagem secundaria nao encontrada.");
  }

  const image = await prisma.productImage.findFirst({
    where: {
      id: imageId,
      ...(admin.shopId ? { shopId: admin.shopId } : {}),
    },
    select: {
      id: true,
      imagePath: true,
    },
  });

  if (!image) {
    throw new Error("Imagem secundaria nao encontrada.");
  }

  await prisma.productImage.delete({
    where: { id: image.id },
  });
  await deleteProductImage(image.imagePath);
  revalidateProductViews();

  return {
    message: "Imagem removida com sucesso.",
  };
}

export async function deleteProduct(id: string) {
  await ensureProductAccess();

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      isActive: true,
      imagePath: true,
      secondaryImages: {
        select: {
          imagePath: true,
        },
      },
      _count: {
        select: {
          stockMovements: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("Maquina nao encontrada.");
  }

  if (product._count.stockMovements > 0) {
    await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        imageUrl: null,
        imagePath: null,
        secondaryImages: {
          deleteMany: {},
        },
      },
    });

    await deleteProductImage(product.imagePath);
    await Promise.allSettled(
      product.secondaryImages.map((image) => deleteProductImage(image.imagePath))
    );
    revalidateProductViews();
    return {
      deleted: false,
      message: product.isActive
        ? "Maquina ocultada para preservar historico de estoque."
        : "Maquina ja estava oculta. Historico de estoque preservado.",
    };
  }

  await prisma.product.delete({
    where: { id },
  });

  await deleteProductImage(product.imagePath);
  await Promise.allSettled(
    product.secondaryImages.map((image) => deleteProductImage(image.imagePath))
  );
  revalidateProductViews();
  return {
    deleted: true,
    message: "Maquina excluida com sucesso.",
  };
}

export async function toggleProduct(id: string) {
  await ensureProductAccess();

  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new Error("Maquina nao encontrada.");
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      isActive: !product.isActive,
    },
  });

  revalidateProductViews();
  return {
    id: updatedProduct.id,
    isActive: updatedProduct.isActive,
  };
}
