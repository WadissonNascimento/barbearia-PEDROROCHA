import "server-only";

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const heicConvert = require("heic-convert") as (options: {
  buffer: Buffer;
  format: "JPEG" | "PNG";
  quality?: number;
}) => Promise<ArrayBuffer | Buffer | Uint8Array>;

const VALID_IMAGE_MESSAGE =
  "O arquivo enviado nao parece ser uma imagem valida. Envie JPG, PNG, WEBP ou HEIC.";
const INVALID_HEIC_MESSAGE =
  "Essa foto do iPhone nao chegou como HEIC valido. Envie como JPG/PNG ou tire uma captura e tente novamente.";
const TYPE_MESSAGE = "Envie uma imagem JPG, PNG, WEBP ou HEIC.";
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HEIC_BRANDS = [
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
];

export function getImageFileExtension(fileName: string | undefined) {
  return String(fileName || "")
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();
}

function normalizeMimeType(type: string | undefined) {
  const normalized = String(type || "").trim().toLowerCase();

  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function hasSignature(buffer: Buffer, type: string) {
  if (type === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (type === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }

  if (type === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

function isHeicBuffer(buffer: Buffer) {
  if (buffer.length < 16 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") {
    return false;
  }

  const brandArea = buffer.subarray(8, Math.min(buffer.length, 40)).toString("ascii");

  return HEIC_BRANDS.some((brand) => brandArea.includes(brand));
}

function inferAllowedImageType(buffer: Buffer) {
  if (hasSignature(buffer, "image/jpeg")) return "image/jpeg";
  if (hasSignature(buffer, "image/png")) return "image/png";
  if (hasSignature(buffer, "image/webp")) return "image/webp";
  if (isHeicBuffer(buffer)) return "image/heic";

  return null;
}

function isHeicByNameOrType(file: File) {
  const mimeType = normalizeMimeType(file.type);
  const extension = getImageFileExtension(file.name);

  return (
    HEIC_TYPES.has(mimeType) ||
    extension === "heic" ||
    extension === "heif"
  );
}

async function convertHeicToJpeg(buffer: Buffer) {
  const converted = await heicConvert({
    buffer,
    format: "JPEG",
    quality: 0.92,
  });

  if (converted instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(converted));
  }

  return Buffer.from(converted);
}

export async function prepareImageFileBuffer(
  file: File,
  {
    maxSizeBytes,
    maxSizeLabel,
    emptyMessage = "Selecione uma imagem para enviar.",
  }: {
    maxSizeBytes: number;
    maxSizeLabel: string;
    emptyMessage?: string;
  }
) {
  if (!file || file.size === 0) {
    throw new Error(emptyMessage);
  }

  if (file.size > maxSizeBytes) {
    throw new Error(`A imagem deve ter no maximo ${maxSizeLabel}.`);
  }

  const declaredType = normalizeMimeType(file.type);
  const buffer = Buffer.from(await file.arrayBuffer());
  const inferredType = inferAllowedImageType(buffer);
  const declaredAsHeic = isHeicByNameOrType(file);

  if (declaredAsHeic && inferredType !== "image/heic") {
    throw new Error(INVALID_HEIC_MESSAGE);
  }

  if (inferredType === "image/heic") {
    try {
      return {
        buffer: await convertHeicToJpeg(buffer),
        mimeType: "image/jpeg",
        wasHeic: true,
      };
    } catch (error) {
      console.warn("[image] Falha ao converter HEIC/HEIF.", {
        fileName: file.name || "(sem nome)",
        mime: file.type || "(sem mime)",
        size: file.size,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(VALID_IMAGE_MESSAGE);
    }
  }

  if (!inferredType) {
    throw new Error(VALID_IMAGE_MESSAGE);
  }

  if (
    declaredType &&
    !ALLOWED_TYPES.has(declaredType) &&
    declaredType !== "application/octet-stream"
  ) {
    throw new Error(TYPE_MESSAGE);
  }

  return {
    buffer,
    mimeType: inferredType,
    wasHeic: false,
  };
}
