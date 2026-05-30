import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { normalizeProductImageUrl } from "@/lib/productImageUrl";
import { processProductImageBuffer } from "@/lib/productImagePipeline";
import {
  getImageFileExtension,
  prepareImageFileBuffer,
} from "@/lib/serverImageFiles";

const MAX_PRODUCT_IMAGE_SIZE = 20 * 1024 * 1024;
const SECONDARY_IMAGE_SIZE = 1600;
const VALID_IMAGE_MESSAGE =
  "O arquivo enviado nao parece ser uma imagem valida. Envie JPG, PNG, WEBP ou HEIC.";

export { normalizeProductImageUrl };

function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para enviar imagens."
    );
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
    bucket,
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function buildPublicUrl(supabaseUrl: string, bucket: string, imagePath: string) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(
    imagePath
  )}`;
}

function normalizeStorageSegment(value: string | null | undefined) {
  return (value || "default").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function logProductImageFailure(stage: string, file: File, error: unknown) {
  console.warn("[product-image] Falha no upload do produto", {
    stage,
    fileName: file.name || "(sem nome)",
    mime: file.type || "(sem mime)",
    extension: getImageFileExtension(file.name) || "(sem extensao)",
    size: file.size,
    error: error instanceof Error ? error.message : String(error),
  });
}

async function getValidatedImageBuffer(file: File) {
  return prepareImageFileBuffer(file, {
    maxSizeBytes: MAX_PRODUCT_IMAGE_SIZE,
    maxSizeLabel: "20MB",
  });
}

async function processSecondaryProductImageBuffer(buffer: Buffer) {
  const outputBuffer = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(SECONDARY_IMAGE_SIZE, SECONDARY_IMAGE_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();

  return {
    buffer: outputBuffer,
    mimeType: "image/webp",
    extension: "webp",
  };
}

export async function uploadProductImage({
  productId,
  shopId,
  file,
}: {
  productId: string;
  shopId?: string | null;
  file: File;
}) {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  let stage = "validacao";

  try {
    const { buffer, mimeType } = await getValidatedImageBuffer(file);
    stage = "processamento";
    const processed = await processProductImageBuffer(buffer, mimeType);
    const extension = processed.extension;
    const imagePath = `products/${normalizeStorageSegment(shopId)}/${productId}/${randomUUID()}.${extension}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(
      imagePath
    )}`;

    stage = "storage";
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Cache-Control": "31536000",
        "Content-Type": processed.mimeType,
        "x-upsert": "false",
      },
      body: new Uint8Array(processed.buffer),
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel enviar a imagem para o Supabase Storage.");
    }

    return {
      imagePath,
      imageUrl: buildPublicUrl(supabaseUrl, bucket, imagePath),
    };
  } catch (error) {
    logProductImageFailure(stage, file, error);
    throw error instanceof Error ? error : new Error(VALID_IMAGE_MESSAGE);
  }
}

export async function uploadSecondaryProductImage({
  productId,
  shopId,
  file,
}: {
  productId: string;
  shopId?: string | null;
  file: File;
}) {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  let stage = "validacao";

  try {
    const { buffer } = await getValidatedImageBuffer(file);
    stage = "processamento";
    const processed = await processSecondaryProductImageBuffer(buffer);
    const imagePath = `products/${normalizeStorageSegment(shopId)}/${productId}/secondary/${randomUUID()}.${processed.extension}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(
      imagePath
    )}`;

    stage = "storage";
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Cache-Control": "31536000",
        "Content-Type": processed.mimeType,
        "x-upsert": "false",
      },
      body: new Uint8Array(processed.buffer),
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel enviar a imagem para o Supabase Storage.");
    }

    return {
      imagePath,
      imageUrl: buildPublicUrl(supabaseUrl, bucket, imagePath),
    };
  } catch (error) {
    logProductImageFailure(stage, file, error);
    throw error instanceof Error ? error : new Error(VALID_IMAGE_MESSAGE);
  }
}

export async function deleteProductImage(imagePath: string | null | undefined) {
  if (!imagePath?.startsWith("products/")) {
    return;
  }

  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefixes: [imagePath],
    }),
  });

  if (!response.ok) {
    console.warn("[storage] Nao foi possivel excluir imagem antiga do produto.");
  }
}
