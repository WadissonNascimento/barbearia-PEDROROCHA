import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prepareImageFileBuffer } from "@/lib/serverImageFiles";

const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1200;

export async function saveBarberPhoto(file: File) {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "barbers");
  await mkdir(uploadDir, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  const absolutePath = path.join(uploadDir, filename);
  const { buffer } = await prepareImageFileBuffer(file, {
    maxSizeBytes: MAX_PHOTO_SIZE,
    maxSizeLabel: "8MB",
    emptyMessage: "Escolha uma foto para enviar.",
  });
  const processedBuffer = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 84 })
    .toBuffer();

  await writeFile(absolutePath, processedBuffer);

  return `/uploads/barbers/${filename}`;
}

export async function deleteLocalBarberPhoto(imagePath: string | null | undefined) {
  if (!imagePath?.startsWith("/uploads/barbers/")) {
    return;
  }

  const absolutePath = path.join(process.cwd(), "public", imagePath);
  const uploadDir = path.join(process.cwd(), "public", "uploads", "barbers");

  if (!absolutePath.startsWith(uploadDir)) {
    return;
  }

  await unlink(absolutePath).catch(() => undefined);
}
