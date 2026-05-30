import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { processProductImageBuffer } from "@/lib/productImagePipeline";

const DIRECTORY = path.join(
  process.cwd(),
  "public",
  "uploads",
  "products",
  "test"
);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const OUTPUT_FORMAT_BY_EXTENSION: Record<string, "jpeg" | "png" | "webp"> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
};

async function main() {
  const entries = await fs.readdir(DIRECTORY, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension];

    if (!mimeType) {
      continue;
    }

    const absolutePath = path.join(DIRECTORY, entry.name);
    const inputBuffer = await fs.readFile(absolutePath);
    const outputFormat = OUTPUT_FORMAT_BY_EXTENSION[extension];
    const processed = await processProductImageBuffer(inputBuffer, mimeType, {
      outputFormat,
    });

    await fs.writeFile(absolutePath, processed.buffer);
    console.log(
      `Processed ${entry.name} -> ${processed.size}x${processed.size} (${processed.backgroundRemoved ? "remove.bg" : "local"})`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
