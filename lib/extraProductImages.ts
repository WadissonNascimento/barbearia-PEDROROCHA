import "server-only";
import { randomUUID } from "crypto";
import { processProductImageBuffer } from "@/lib/productImagePipeline";
import { normalizeProductImageUrl } from "@/lib/productImageUrl";
import { prepareImageFileBuffer } from "@/lib/serverImageFiles";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

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

async function getValidatedImageBuffer(file: File) {
  return prepareImageFileBuffer(file, {
    maxSizeBytes: MAX_IMAGE_SIZE,
    maxSizeLabel: "8MB",
  });
}

export async function uploadExtraProductImage({
  extraProductId,
  shopId,
  file,
}: {
  extraProductId: string;
  shopId?: string | null;
  file: File;
}) {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const { buffer, mimeType } = await getValidatedImageBuffer(file);
  const processed = await processProductImageBuffer(buffer, mimeType);
  const imagePath = `extras/${normalizeStorageSegment(shopId)}/${extraProductId}/${randomUUID()}.${processed.extension}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(
    imagePath
  )}`;

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
}

export async function deleteExtraProductImage(imagePath: string | null | undefined) {
  if (!imagePath?.startsWith("extras/")) {
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
    console.warn("[storage] Nao foi possivel excluir imagem antiga do extra.");
  }
}
