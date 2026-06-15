import path from "node:path";
import fs from "node:fs/promises";
import type { StreamingPreset } from "../interfaces/options.interface";

export interface TranscodeResult {
  /** Duration of the source video in seconds. */
  duration: number;
  /** Storage-relative paths of all files written under outputDir. */
  files: string[];
}

async function tryImportFfmpeg(): Promise<typeof import("fluent-ffmpeg") | null> {
  try {
    const mod = await import("fluent-ffmpeg");
    return mod.default ?? (mod as unknown as typeof import("fluent-ffmpeg"));
  } catch {
    return null;
  }
}

function buildScaleFilter(preset: StreamingPreset): string {
  if (preset.width && preset.height) return `scale=${preset.width}:${preset.height}`;
  if (preset.width) return `scale=${preset.width}:-2`;
  if (preset.height) return `scale=-2:${preset.height}`;
  return "scale=-2:-2";
}

async function collectFiles(dir: string, base: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(full, rel)));
    } else {
      results.push(rel);
    }
  }
  return results;
}

/**
 * Transcode source video to multi-bitrate HLS.
 *
 * Writes to outputDir:
 *   {preset.name}/index.m3u8
 *   {preset.name}/seg%03d.ts
 *   master.m3u8
 */
export async function transcodeHLS(
  inputPath: string,
  outputDir: string,
  presets: StreamingPreset[],
  segmentDuration: number
): Promise<TranscodeResult> {
  const ffmpeg = await tryImportFfmpeg();
  if (!ffmpeg) throw new FfmpegNotFoundError();

  // Create per-preset subdirectories
  await Promise.all(
    presets.map((p) => fs.mkdir(path.join(outputDir, p.name), { recursive: true }))
  );

  let duration = 0;

  // Run one ffmpeg pass per preset (fluent-ffmpeg doesn't support multi-output HLS natively)
  await Promise.all(
    presets.map(
      (preset) =>
        new Promise<void>((resolve, reject) => {
          const variantDir = path.join(outputDir, preset.name);
          const playlistPath = path.join(variantDir, "index.m3u8");
          const segmentPattern = path.join(variantDir, "seg%03d.ts");

          const cmd = ffmpeg(inputPath)
            .videoCodec(preset.videoCodec ?? "libx264")
            .audioCodec(preset.audioCodec ?? "aac")
            .videoFilters(buildScaleFilter(preset))
            .outputOptions([
              `-b:v ${preset.videoBitrate ?? "1000k"}`,
              `-b:a ${preset.audioBitrate ?? "128k"}`,
              "-f hls",
              `-hls_time ${segmentDuration}`,
              "-hls_playlist_type vod",
              "-hls_flags independent_segments",
              `-hls_segment_filename ${segmentPattern}`,
            ])
            .output(playlistPath);

          cmd.on("error", (err: Error) => reject(err));
          cmd.on("end", () => resolve());
          cmd.on("codecData", (data: { duration?: string }) => {
            if (data.duration) {
              const parts = data.duration.split(":").map(Number);
              duration = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
            }
          });
          cmd.run();
        })
    )
  );

  // Write master playlist manually
  const masterLines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const preset of presets) {
    const bandwidth = parseInt((preset.videoBitrate ?? "1000k").replace(/\D/g, ""), 10) * 1000;
    const resolution =
      preset.width && preset.height ? `RESOLUTION=${preset.width}x${preset.height}` : "";
    const attrs = [`BANDWIDTH=${bandwidth}`, resolution].filter(Boolean).join(",");
    masterLines.push(`#EXT-X-STREAM-INF:${attrs}`, `${preset.name}/index.m3u8`);
  }
  await fs.writeFile(path.join(outputDir, "master.m3u8"), masterLines.join("\n") + "\n", "utf8");

  const files = await collectFiles(outputDir, "");
  return { duration, files };
}

/**
 * Transcode source video to multi-bitrate DASH.
 *
 * Writes to outputDir:
 *   {preset.name}/seg%03d.m4s
 *   master.mpd
 */
export async function transcodeDASH(
  inputPath: string,
  outputDir: string,
  presets: StreamingPreset[],
  segmentDuration: number
): Promise<TranscodeResult> {
  const ffmpeg = await tryImportFfmpeg();
  if (!ffmpeg) throw new FfmpegNotFoundError();

  await Promise.all(
    presets.map((p) => fs.mkdir(path.join(outputDir, p.name), { recursive: true }))
  );

  let duration = 0;

  await Promise.all(
    presets.map(
      (preset) =>
        new Promise<void>((resolve, reject) => {
          const variantDir = path.join(outputDir, preset.name);
          const segmentPattern = path.join(variantDir, "seg%03d.m4s");
          const initSegment = path.join(variantDir, "init.mp4");
          const manifestPath = path.join(variantDir, "stream.mpd");

          const cmd = ffmpeg(inputPath)
            .videoCodec(preset.videoCodec ?? "libx264")
            .audioCodec(preset.audioCodec ?? "aac")
            .videoFilters(buildScaleFilter(preset))
            .outputOptions([
              `-b:v ${preset.videoBitrate ?? "1000k"}`,
              `-b:a ${preset.audioBitrate ?? "128k"}`,
              "-f dash",
              `-seg_duration ${segmentDuration}`,
              "-use_template 1",
              "-use_timeline 1",
              `-init_seg_name ${initSegment}`,
              `-media_seg_name ${segmentPattern}`,
            ])
            .output(manifestPath);

          cmd.on("error", (err: Error) => reject(err));
          cmd.on("end", () => resolve());
          cmd.on("codecData", (data: { duration?: string }) => {
            if (data.duration) {
              const parts = data.duration.split(":").map(Number);
              duration = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
            }
          });
          cmd.run();
        })
    )
  );

  const files = await collectFiles(outputDir, "");
  return { duration, files };
}

export class FfmpegNotFoundError extends Error {
  constructor() {
    super(
      "fluent-ffmpeg could not be imported. Install it: pnpm add fluent-ffmpeg. " +
        "Also ensure the ffmpeg binary is available in PATH."
    );
    this.name = "FfmpegNotFoundError";
  }
}
