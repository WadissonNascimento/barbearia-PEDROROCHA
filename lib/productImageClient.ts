"use client";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_SOURCE_IMAGE_SIZE = 20 * 1024 * 1024;
const OUTPUT_IMAGE_SIZE = 1600;
const SECONDARY_OUTPUT_IMAGE_SIZE = 1600;
const MAX_SECONDARY_UPLOAD_SIZE = 8 * 1024 * 1024;
const TARGET_PRODUCT_FILL = 0.94;
const EDGE_ALPHA_THRESHOLD = 18;
const EDGE_COLOR_THRESHOLD = 34;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const HEIC_IMAGE_TYPES = new Set(["image/heic", "image/heif"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const HEIC_IMAGE_EXTENSIONS = new Set(["heic", "heif"]);
const IMAGE_TYPE_MESSAGE = "Envie uma imagem JPG, PNG, WEBP ou HEIC.";
const INVALID_IMAGE_MESSAGE =
  "O arquivo enviado nao parece ser uma imagem valida. Envie JPG, PNG, WEBP ou HEIC.";
const INVALID_HEIC_MESSAGE =
  "Essa foto do iPhone nao chegou como HEIC valido. Envie como JPG/PNG ou tire uma captura e tente novamente.";
const IMAGE_DECODE_MESSAGE =
  "Nao foi possivel ler essa foto no navegador. No iPhone, aguarde a foto baixar do iCloud ou envie como JPG/PNG.";
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

function getExtension(fileName: string | undefined) {
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

function validateProductImage(file: File) {
  const mimeType = normalizeMimeType(file.type);
  const extension = getExtension(file.name);

  if (
    !(
      (mimeType && (ALLOWED_IMAGE_TYPES.has(mimeType) || HEIC_IMAGE_TYPES.has(mimeType))) ||
      (extension && ALLOWED_IMAGE_EXTENSIONS.has(extension))
    )
  ) {
    throw new Error(IMAGE_TYPE_MESSAGE);
  }
}

function isHeicImage(file: File) {
  const mimeType = normalizeMimeType(file.type);
  const extension = getExtension(file.name);

  return (
    HEIC_IMAGE_TYPES.has(mimeType) ||
    Boolean(extension && HEIC_IMAGE_EXTENSIONS.has(extension))
  );
}

function validateSourceSize(file: File) {
  if (file.size > MAX_SOURCE_IMAGE_SIZE) {
    throw new Error("A imagem deve ter no maximo 20MB.");
  }
}

function bytesToAscii(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function hasSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (type === "image/png") {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    return pngSignature.every((byte, index) => bytes[index] === byte);
  }

  if (type === "image/webp") {
    return (
      bytesToAscii(bytes.slice(0, 4)) === "RIFF" &&
      bytesToAscii(bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
}

function isHeicHeader(bytes: Uint8Array) {
  if (bytes.length < 16 || bytesToAscii(bytes.slice(4, 8)) !== "ftyp") {
    return false;
  }

  const brandArea = bytesToAscii(bytes.slice(8, Math.min(bytes.length, 40)));

  return HEIC_BRANDS.some((brand) => brandArea.includes(brand));
}

function inferAllowedImageTypeFromHeader(bytes: Uint8Array) {
  if (hasSignature(bytes, "image/jpeg")) return "image/jpeg";
  if (hasSignature(bytes, "image/png")) return "image/png";
  if (hasSignature(bytes, "image/webp")) return "image/webp";
  if (isHeicHeader(bytes)) return "image/heic";

  return null;
}

async function validateImageContent(file: File) {
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const inferredType = inferAllowedImageTypeFromHeader(header);

  if (isHeicImage(file) && inferredType !== "image/heic") {
    throw new Error(INVALID_HEIC_MESSAGE);
  }

  if (!inferredType) {
    throw new Error(INVALID_IMAGE_MESSAGE);
  }

  return inferredType;
}

type DecodedImage = {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeImageWithElement(file: File): Promise<DecodedImage> {
  const previewUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = "async";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(IMAGE_DECODE_MESSAGE));
      element.src = previewUrl;
    });

    return {
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(previewUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

async function decodeImageFile(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);

      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Safari/iOS pode falhar aqui mesmo com uma imagem valida. Tentamos via <img>.
    }
  }

  return decodeImageWithElement(file);
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  mimeType = "image/webp"
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

async function compressCanvasToProductBlob(canvas: HTMLCanvasElement) {
  const qualities = [0.94, 0.9, 0.86, 0.8, 0.72];

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality);

    if (blob && blob.type === "image/webp" && blob.size <= MAX_IMAGE_SIZE) {
      return blob;
    }
  }

  const fallbackWebp = await canvasToBlob(canvas, 0.64);

  if (fallbackWebp?.type === "image/webp") {
    return fallbackWebp;
  }

  for (const quality of [0.92, 0.86, 0.78, 0.68]) {
    const blob = await canvasToBlob(canvas, quality, "image/jpeg");

    if (blob && blob.size <= MAX_IMAGE_SIZE) {
      return blob;
    }
  }

  return canvasToBlob(canvas, 0.6, "image/jpeg");
}

async function compressCanvasToSecondaryBlob(canvas: HTMLCanvasElement) {
  const qualities = [0.92, 0.88, 0.82, 0.74];

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality);

    if (blob && blob.type === "image/webp" && blob.size <= MAX_SECONDARY_UPLOAD_SIZE) {
      return blob;
    }
  }

  const fallbackWebp = await canvasToBlob(canvas, 0.68);

  if (fallbackWebp?.type === "image/webp") {
    return fallbackWebp;
  }

  for (const quality of [0.9, 0.82, 0.74]) {
    const blob = await canvasToBlob(canvas, quality, "image/jpeg");

    if (blob && blob.size <= MAX_SECONDARY_UPLOAD_SIZE) {
      return blob;
    }
  }

  return canvasToBlob(canvas, 0.68, "image/jpeg");
}

function getBackgroundReference(data: Uint8ClampedArray, width: number, height: number) {
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalA = 0;

  for (const [x, y] of samplePoints) {
    const index = (y * width + x) * 4;
    totalR += data[index] ?? 255;
    totalG += data[index + 1] ?? 255;
    totalB += data[index + 2] ?? 255;
    totalA += data[index + 3] ?? 255;
  }

  const count = samplePoints.length;

  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count,
    a: totalA / count,
  };
}

function colorDistance(
  red: number,
  green: number,
  blue: number,
  background: { r: number; g: number; b: number }
) {
  return Math.sqrt(
    (red - background.r) ** 2 +
      (green - background.g) ** 2 +
      (blue - background.b) ** 2
  );
}

function isBackgroundLike(
  data: Uint8ClampedArray,
  index: number,
  background: { r: number; g: number; b: number }
) {
  const alpha = data[index + 3] ?? 255;

  if (alpha < EDGE_ALPHA_THRESHOLD) {
    return true;
  }

  const red = data[index] ?? 255;
  const green = data[index + 1] ?? 255;
  const blue = data[index + 2] ?? 255;

  return colorDistance(red, green, blue, background) <= EDGE_COLOR_THRESHOLD;
}

function getContentBounds(image: CanvasImageSource, imageWidth: number, imageHeight: number) {
  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = imageWidth;
  probeCanvas.height = imageHeight;

  const context = probeCanvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return {
      left: 0,
      top: 0,
      width: imageWidth,
      height: imageHeight,
    };
  }

  context.drawImage(image, 0, 0, imageWidth, imageHeight);

  const { data, width, height } = context.getImageData(0, 0, imageWidth, imageHeight);
  const background = getBackgroundReference(data, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const flatIndex = y * width + x;

    if (visited[flatIndex]) {
      return;
    }

    const pixelIndex = flatIndex * 4;

    if (!isBackgroundLike(data, pixelIndex, background)) {
      return;
    }

    visited[flatIndex] = 1;
    queue[tail] = flatIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const flatIndex = queue[head];
    head += 1;

    const x = flatIndex % width;
    const y = Math.floor(flatIndex / width);

    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const flatIndex = y * width + x;
      if (visited[flatIndex]) {
        continue;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX === -1 || maxY === -1) {
    return {
      left: 0,
      top: 0,
      width: imageWidth,
      height: imageHeight,
    };
  }

  const padding = Math.max(18, Math.round(Math.max(width, height) * 0.04));
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function drawMarketplaceBackground(
  context: CanvasRenderingContext2D,
  size: number
) {
  context.fillStyle = "#eef2f7";
  context.fillRect(0, 0, size, size);

  const glow = context.createRadialGradient(
    size * 0.5,
    size * 0.46,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );
  glow.addColorStop(0, "rgba(255,255,255,0.2)");
  glow.addColorStop(0.62, "rgba(255,255,255,0.06)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
}

function drawStandardizedProduct(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  bounds: { left: number; top: number; width: number; height: number },
  size: number
) {
  const maxBox = size * TARGET_PRODUCT_FILL;
  const scale = Math.min(maxBox / bounds.width, maxBox / bounds.height);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) / 2);

  context.drawImage(
    image,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    x,
    y,
    width,
    height
  );
}

export async function prepareProductImageUpload(file: File) {
  validateProductImage(file);
  validateSourceSize(file);
  await validateImageContent(file);

  let decodedImage: DecodedImage;

  try {
    decodedImage = await decodeImageFile(file);
  } catch {
    if (isHeicImage(file)) {
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    }

    throw new Error(INVALID_IMAGE_MESSAGE);
  }
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_IMAGE_SIZE;
  canvas.height = OUTPUT_IMAGE_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    decodedImage.close();
    return {
      file,
      previewUrl: URL.createObjectURL(file),
    };
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const bounds = getContentBounds(
    decodedImage.image,
    decodedImage.width,
    decodedImage.height
  );
  drawMarketplaceBackground(context, OUTPUT_IMAGE_SIZE);
  drawStandardizedProduct(context, decodedImage.image, bounds, OUTPUT_IMAGE_SIZE);
  decodedImage.close();

  const blob = await compressCanvasToProductBlob(canvas);
  const uploadFile =
    blob && blob.size <= MAX_IMAGE_SIZE
      ? new File(
          [blob],
          blob.type === "image/webp"
            ? "prepared-product-image.webp"
            : "prepared-product-image.jpg",
          { type: blob.type || "image/jpeg" }
        )
      : file;

  if (uploadFile.size > MAX_IMAGE_SIZE) {
    throw new Error("A imagem comprimida ainda ficou acima de 2MB.");
  }

  return {
    file: uploadFile,
    previewUrl: URL.createObjectURL(uploadFile),
  };
}

export async function prepareSecondaryProductImageUpload(file: File) {
  validateProductImage(file);
  validateSourceSize(file);
  await validateImageContent(file);

  let decodedImage: DecodedImage;

  try {
    decodedImage = await decodeImageFile(file);
  } catch {
    if (isHeicImage(file)) {
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    }

    throw new Error(IMAGE_DECODE_MESSAGE);
  }

  const scale = Math.min(
    1,
    SECONDARY_OUTPUT_IMAGE_SIZE / Math.max(decodedImage.width, decodedImage.height)
  );
  const width = Math.max(1, Math.round(decodedImage.width * scale));
  const height = Math.max(1, Math.round(decodedImage.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    decodedImage.close();
    return {
      file,
      previewUrl: URL.createObjectURL(file),
    };
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decodedImage.image, 0, 0, width, height);
  decodedImage.close();

  const blob = await compressCanvasToSecondaryBlob(canvas);

  if (!blob) {
    throw new Error("Nao foi possivel compactar a foto secundaria.");
  }

  const uploadFile = new File(
    [blob],
    blob.type === "image/webp"
      ? "secondary-product-image.webp"
      : "secondary-product-image.jpg",
    {
      type: blob.type || "image/jpeg",
    }
  );

  return {
    file: uploadFile,
    previewUrl: URL.createObjectURL(uploadFile),
  };
}

