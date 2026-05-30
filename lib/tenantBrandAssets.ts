import "server-only";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prepareImageFileBuffer } from "@/lib/serverImageFiles";

const MAX_TENANT_LOGO_SIZE = 5 * 1024 * 1024;
const MAX_TENANT_LOGO_DIMENSION = 1200;

type StorageConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
};

function getStorageConfig(): StorageConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images";

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
    bucket,
  };
}

function encodeStoragePath(assetPath: string) {
  return assetPath.split("/").map(encodeURIComponent).join("/");
}

function buildPublicUrl(config: StorageConfig, assetPath: string) {
  return `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/${encodeStoragePath(
    assetPath,
  )}`;
}

function normalizeAssetSegment(value: string | null | undefined) {
  return (value || "tenant")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "tenant";
}

async function processLogoFile(file: File) {
  const { buffer } = await prepareImageFileBuffer(file, {
    maxSizeBytes: MAX_TENANT_LOGO_SIZE,
    maxSizeLabel: "5MB",
    emptyMessage: "Escolha uma logo para enviar.",
  });

  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(MAX_TENANT_LOGO_DIMENSION, MAX_TENANT_LOGO_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();
}

async function uploadToSupabase(config: StorageConfig, file: File, segment: string) {
  const processedBuffer = await processLogoFile(file);
  const assetPath = `tenant-brand/${segment}/${Date.now()}-${randomUUID()}.webp`;
  const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${encodeStoragePath(
    assetPath,
  )}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Cache-Control": "31536000",
      "Content-Type": "image/webp",
      "x-upsert": "false",
    },
    body: new Uint8Array(processedBuffer),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel enviar a logo para o Storage.");
  }

  return {
    assetPath,
    assetUrl: buildPublicUrl(config, assetPath),
  };
}

async function uploadToLocalPublic(file: File, segment: string) {
  const processedBuffer = await processLogoFile(file);
  const uploadDir = path.join(process.cwd(), "public", "uploads", "tenant-brand", segment);
  const filename = `${Date.now()}-${randomUUID()}.webp`;
  const absolutePath = path.join(uploadDir, filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(absolutePath, processedBuffer);

  return {
    assetPath: `/uploads/tenant-brand/${segment}/${filename}`,
    assetUrl: `/uploads/tenant-brand/${segment}/${filename}`,
  };
}

export async function uploadTenantLogo(file: File, tenantSegment: string | null | undefined) {
  const segment = normalizeAssetSegment(tenantSegment);
  const storageConfig = getStorageConfig();

  if (storageConfig) {
    return uploadToSupabase(storageConfig, file, segment);
  }

  return uploadToLocalPublic(file, segment);
}

export async function deleteTenantBrandAsset(assetPath: string | null | undefined) {
  if (!assetPath) {
    return;
  }

  if (assetPath.startsWith("/uploads/tenant-brand/")) {
    const uploadRoot = path.join(process.cwd(), "public", "uploads", "tenant-brand");
    const absolutePath = path.join(process.cwd(), "public", assetPath);

    if (absolutePath.startsWith(uploadRoot)) {
      await unlink(absolutePath).catch(() => undefined);
    }

    return;
  }

  if (!assetPath.startsWith("tenant-brand/")) {
    return;
  }

  const storageConfig = getStorageConfig();

  if (!storageConfig) {
    return;
  }

  const response = await fetch(`${storageConfig.supabaseUrl}/storage/v1/object/${storageConfig.bucket}`, {
    method: "DELETE",
    headers: {
      apikey: storageConfig.serviceRoleKey,
      Authorization: `Bearer ${storageConfig.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefixes: [assetPath],
    }),
  });

  if (!response.ok) {
    console.warn("[storage] Nao foi possivel excluir asset antigo do tenant.");
  }
}
