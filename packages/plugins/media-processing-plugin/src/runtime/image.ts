import type { ThumbnailResult } from "@better-media/core";
import type { ThumbnailPreset, ThumbnailResizeFit } from "../interfaces/options.interface";

const ALLOWED_FIT = new Set<ThumbnailResizeFit>(["cover", "contain", "fill", "inside", "outside"]);

/** Safe Sharp `fit` (unknown values fall back to `inside`). */
export function normalizeResizeFit(fit: ThumbnailPreset["fit"]): ThumbnailResizeFit {
  if (fit != null && ALLOWED_FIT.has(fit)) return fit;
  return "inside";
}

/** Sharp default export (dynamic import only — do not add a static `import "sharp"`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Sharp's chain type varies by version
type SharpFactory = (input?: Buffer) => any;

export async function tryImportSharp(): Promise<SharpFactory | null> {
  try {
    const mod = await import("sharp");
    return (mod.default ?? mod) as SharpFactory;
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      return null;
    }
    throw err;
  }
}

function formatExtension(format: ThumbnailPreset["format"]): string {
  switch (format ?? "webp") {
    case "jpeg":
    case "jpg":
      return "jpg";
    case "png":
      return "png";
    case "avif":
      return "avif";
    case "webp":
    default:
      return "webp";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOutputFormat(pipeline: any, preset: ThumbnailPreset): any {
  const q = preset.quality ?? 80;
  const fmt = preset.format ?? "webp";
  switch (fmt) {
    case "jpeg":
    case "jpg":
      return pipeline.jpeg({ quality: q, mozjpeg: true });
    case "png":
      return pipeline.png({ compressionLevel: 9 });
    case "avif":
      return pipeline.avif({ quality: q });
    case "webp":
    default:
      return pipeline.webp({ quality: q });
  }
}

export interface GeneratedThumbnail {
  result: ThumbnailResult;
  buffer: Buffer;
}

/**
 * Build thumbnails with Sharp; caller handles storage.put and persistence.
 */
export async function generateThumbnailsWithSharp(
  sharp: SharpFactory,
  input: Buffer,
  presets: ThumbnailPreset[],
  recordId: string,
  derivativePrefix: string
): Promise<{ dimensions?: { width: number; height: number }; thumbnails: GeneratedThumbnail[] }> {
  const meta = await sharp(input).metadata();
  const dimensions =
    meta.width != null && meta.height != null
      ? { width: meta.width, height: meta.height }
      : undefined;

  const thumbnails: GeneratedThumbnail[] = [];

  for (const preset of presets) {
    if (!preset.name?.trim()) continue;

    let pipeline = sharp(input).rotate();
    if (preset.width != null || preset.height != null) {
      pipeline = pipeline.resize({
        width: preset.width,
        height: preset.height,
        fit: normalizeResizeFit(preset.fit),
        withoutEnlargement: true,
      });
    }

    pipeline = applyOutputFormat(pipeline, preset);

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    const ext = formatExtension(preset.format);
    const storageKey = `${derivativePrefix}/${recordId}/thumb-${preset.name}.${ext}`;

    thumbnails.push({
      buffer: data,
      result: {
        key: storageKey,
        width: info.width,
        height: info.height,
        format: ext,
      },
    });
  }

  return { dimensions, thumbnails };
}
