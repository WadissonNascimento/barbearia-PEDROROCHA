import sharp from "sharp";

const OUTPUT_IMAGE_SIZE = 1600;
const TARGET_PRODUCT_FILL = 0.94;
const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

const OUTPUT_BACKGROUND = {
  r: 238,
  g: 242,
  b: 247,
  alpha: 1,
} as const;

export async function processProductImageBuffer(
  inputBuffer: Buffer,
  mimeType: string,
  options?: {
    outputFormat?: "webp" | "jpeg" | "png";
  }
) {
  const outputFormat = options?.outputFormat ?? "webp";
  const backgroundRemoved = await removeBackgroundIfConfigured(
    inputBuffer,
    mimeType
  ).catch((error) => {
    console.warn("[product-image] remove.bg falhou, seguindo com o arquivo original.", error);
    return {
      buffer: inputBuffer,
      mimeType,
      backgroundRemoved: false,
    };
  });

  const innerSize = Math.round(OUTPUT_IMAGE_SIZE * TARGET_PRODUCT_FILL);
  const foreground = await sharp(backgroundRemoved.buffer, { failOn: "none" })
    .rotate()
    .trim()
    .resize(innerSize, innerSize, {
      fit: "inside",
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: OUTPUT_IMAGE_SIZE,
      height: OUTPUT_IMAGE_SIZE,
      channels: 4,
      background: OUTPUT_BACKGROUND,
    },
  }).composite([{ input: foreground, gravity: "center" }]);

  const outputBuffer =
    outputFormat === "png"
      ? await canvas.png({ compressionLevel: 9 }).toBuffer()
      : outputFormat === "jpeg"
        ? await canvas.jpeg({ quality: 96 }).toBuffer()
        : await canvas.webp({ quality: 94 }).toBuffer();

  return {
    buffer: outputBuffer,
    mimeType:
      outputFormat === "png"
        ? "image/png"
        : outputFormat === "jpeg"
          ? "image/jpeg"
          : "image/webp",
    extension: outputFormat === "jpeg" ? "jpg" : outputFormat,
    size: OUTPUT_IMAGE_SIZE,
    backgroundRemoved: backgroundRemoved.backgroundRemoved,
  };
}

async function removeBackgroundIfConfigured(
  inputBuffer: Buffer,
  mimeType: string
) {
  const apiKey = process.env.REMOVE_BG_API_KEY?.trim();

  if (!apiKey) {
    return {
      buffer: inputBuffer,
      mimeType,
      backgroundRemoved: false,
    };
  }

  const requestedSize = process.env.REMOVE_BG_SIZE?.trim() || "full";
  const sizesToTry =
    requestedSize === "full" ? ["full", "auto"] : [requestedSize, "auto"];
  let lastError: Error | null = null;

  for (const size of [...new Set(sizesToTry)]) {
    try {
      return await requestRemoveBackground({
        apiKey,
        inputBuffer,
        mimeType,
        size,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (size !== "auto") {
        console.warn(
          `[product-image] remove.bg size=${size} falhou, tentando auto.`,
          lastError
        );
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("remove.bg falhou.");
}

async function requestRemoveBackground({
  apiKey,
  inputBuffer,
  mimeType,
  size,
}: {
  apiKey: string;
  inputBuffer: Buffer;
  mimeType: string;
  size: string;
}) {
  const formData = new FormData();
  formData.append("size", size);
  formData.append("type", "product");
  formData.append("crop", "true");
  formData.append("format", "png");
  const bodyBytes = new Uint8Array(inputBuffer);
  formData.append(
    "image_file",
    new Blob([bodyBytes], { type: mimeType }),
    "product-image"
  );

  const response = await fetch(REMOVE_BG_ENDPOINT, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`remove.bg ${response.status}: ${message}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: "image/png",
    backgroundRemoved: true,
  };
}
