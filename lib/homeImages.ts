import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { prepareImageFileBuffer } from "@/lib/serverImageFiles";

const MAX_HOME_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_HOME_IMAGE_DIMENSION = 2200;

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

async function getValidatedHomeImageBuffer(file: File) {
  const { buffer } = await prepareImageFileBuffer(file, {
    maxSizeBytes: MAX_HOME_IMAGE_SIZE,
    maxSizeLabel: "8MB",
  });

  return buffer;
}

async function processHomeImageBuffer(buffer: Buffer) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(MAX_HOME_IMAGE_DIMENSION, MAX_HOME_IMAGE_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();
}

function normalizeStorageSegment(value: string | null | undefined) {
  return (value || "default").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export async function uploadHomeImage(file: File, shopId?: string | null) {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const buffer = await getValidatedHomeImageBuffer(file);
  const processedBuffer = await processHomeImageBuffer(buffer);
  const imagePath = `home/${normalizeStorageSegment(shopId)}/${Date.now()}-${randomUUID()}.webp`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(
    imagePath
  )}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Cache-Control": "31536000",
      "Content-Type": "image/webp",
      "x-upsert": "false",
    },
    body: new Uint8Array(processedBuffer),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel enviar a imagem para o Supabase Storage.");
  }

  return {
    imagePath,
    imageUrl: buildPublicUrl(supabaseUrl, bucket, imagePath),
  };
}

export async function deleteHomeImage(imagePath: string | null | undefined) {
  if (!imagePath?.startsWith("home/")) {
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
    console.warn("[storage] Nao foi possivel excluir imagem antiga da home.");
  }
}
