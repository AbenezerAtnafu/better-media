import path from "node:path";
import fs from "node:fs/promises";
import type { AudioPreset } from "../interfaces/options.interface";
import { inferProgressiveFormat } from "../interfaces/options.interface";

export interface TranscodeResult {
  duration: number;
}

async function tryImportFfmpeg(): Promise<typeof import("fluent-ffmpeg") | null> {
  try {
    const mod = await import("fluent-ffmpeg");
    return mod.default ?? (mod as unknown as typeof import("fluent-ffmpeg"));
  } catch {
    return null;
  }
}

function parseDuration(raw: string): number {
  const parts = raw.split(":").map(Number);
  return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
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

function audioOutputOptions(preset: AudioPreset, extra: string[]): string[] {
  return [
    `-b:a ${preset.bitrate ?? "128k"}`,
    ...(preset.sampleRate ? [`-ar ${preset.sampleRate}`] : []),
    ...(preset.channels ? [`-ac ${preset.channels}`] : []),
    ...extra,
  ];
}

/**
 * Transcode audio to multi-bitrate HLS.
 *
 * Writes to outputDir:
 *   {preset.name}/index.m3u8
 *   {preset.name}/seg%03d.ts
 *   master.m3u8
 */
export async function transcodeHLS(
  inputPath: string,
  outputDir: string,
  presets: AudioPreset[],
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
          const playlistPath = path.join(variantDir, "index.m3u8");
          const segmentPattern = path.join(variantDir, "seg%03d.ts");

          const cmd = ffmpeg(inputPath)
            .noVideo()
            .audioCodec(preset.codec ?? "aac")
            .outputOptions(
              audioOutputOptions(preset, [
                "-f hls",
                `-hls_time ${segmentDuration}`,
                "-hls_playlist_type vod",
                "-hls_flags independent_segments",
                `-hls_segment_filename ${segmentPattern}`,
              ])
            )
            .output(playlistPath);

          cmd.on("error", (err: Error) => reject(err));
          cmd.on("end", () => resolve());
          cmd.on("codecData", (data: { duration?: string }) => {
            if (data.duration && duration === 0) duration = parseDuration(data.duration);
          });
          cmd.run();
        })
    )
  );

  // Master playlist — audio-only streams use BANDWIDTH only (no resolution)
  const masterLines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const preset of presets) {
    const bandwidth = parseInt((preset.bitrate ?? "128k").replace(/\D/g, ""), 10) * 1000;
    const codec = (preset.codec ?? "aac") === "aac" ? ',CODECS="mp4a.40.2"' : "";
    masterLines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}${codec}`,
      `${preset.name}/index.m3u8`
    );
  }
  await fs.writeFile(path.join(outputDir, "master.m3u8"), masterLines.join("\n") + "\n", "utf8");

  return { duration };
}

/**
 * Transcode audio to multi-bitrate DASH.
 *
 * Writes to outputDir:
 *   {preset.name}/seg%03d.m4s
 *   master.mpd
 */
export async function transcodeDASH(
  inputPath: string,
  outputDir: string,
  presets: AudioPreset[],
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
            .noVideo()
            .audioCodec(preset.codec ?? "aac")
            .outputOptions(
              audioOutputOptions(preset, [
                "-f dash",
                `-seg_duration ${segmentDuration}`,
                "-use_template 1",
                "-use_timeline 1",
                `-init_seg_name ${initSegment}`,
                `-media_seg_name ${segmentPattern}`,
              ])
            )
            .output(manifestPath);

          cmd.on("error", (err: Error) => reject(err));
          cmd.on("end", () => resolve());
          cmd.on("codecData", (data: { duration?: string }) => {
            if (data.duration && duration === 0) duration = parseDuration(data.duration);
          });
          cmd.run();
        })
    )
  );

  return { duration };
}

/**
 * Transcode audio to individual files per preset (progressive download).
 *
 * Writes to outputDir:
 *   {preset.name}{ext}   e.g. high.aac, medium.mp3
 */
export async function transcodeProgressive(
  inputPath: string,
  outputDir: string,
  presets: AudioPreset[]
): Promise<TranscodeResult> {
  const ffmpeg = await tryImportFfmpeg();
  if (!ffmpeg) throw new FfmpegNotFoundError();

  let duration = 0;

  await Promise.all(
    presets.map(
      (preset) =>
        new Promise<void>((resolve, reject) => {
          const { ext, ffmpegFormat } = inferProgressiveFormat(preset.codec ?? "aac");
          const outputPath = path.join(outputDir, `${preset.name}${ext}`);

          const cmd = ffmpeg(inputPath)
            .noVideo()
            .audioCodec(preset.codec ?? "aac")
            .outputOptions(audioOutputOptions(preset, [`-f ${ffmpegFormat}`]))
            .output(outputPath);

          cmd.on("error", (err: Error) => reject(err));
          cmd.on("end", () => resolve());
          cmd.on("codecData", (data: { duration?: string }) => {
            if (data.duration && duration === 0) duration = parseDuration(data.duration);
          });
          cmd.run();
        })
    )
  );

  return { duration };
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

export { collectFiles };
