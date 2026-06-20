import { spawn } from "node:child_process";
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

async function getFfmpegBinaryPath(): Promise<string | null> {
  const mod = await tryImportFfmpeg();
  if (!mod) return null;
  const configured = (mod as unknown as { getFfmpegPath?: () => string }).getFfmpegPath?.();
  return typeof configured === "string" && configured.length > 0 ? configured : "ffmpeg";
}

function parseTimemarkSecs(timemark: string): number {
  const parts = timemark.split(":").map(Number);
  return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
}

function parseDurationSecs(stderr: string): number {
  const match = stderr.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
  return match ? parseTimemarkSecs(match[1]!) : 0;
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
  segmentDuration: number,
  onProgress?: (event: { preset?: string; percent?: number; currentTimeSecs?: number }) => void
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
              duration = parseTimemarkSecs(data.duration);
            }
          });
          cmd.on("progress", (progress: { percent?: number; timemark?: string }) => {
            onProgress?.({
              preset: preset.name,
              percent:
                typeof progress.percent === "number"
                  ? Math.min(100, Math.round(progress.percent))
                  : undefined,
              currentTimeSecs: progress.timemark ? parseTimemarkSecs(progress.timemark) : undefined,
            });
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
 * Transcode source video to multi-bitrate DASH using a single ffmpeg pass.
 *
 * Writes to outputDir:
 *   master.mpd                               ← combined manifest for all representations
 *   init-stream$RepresentationID$.mp4        ← per-representation init segment
 *   chunk-stream$RepresentationID$-NNN.m4s   ← media segments
 *
 * All representations are declared in a single master.mpd so ABR players can
 * switch between quality levels. This differs from the old per-preset approach
 * which wrote separate stream.mpd files with no combined manifest.
 */
export async function transcodeDASH(
  inputPath: string,
  outputDir: string,
  presets: StreamingPreset[],
  segmentDuration: number,
  onProgress?: (event: { preset?: string; percent?: number; currentTimeSecs?: number }) => void
): Promise<TranscodeResult> {
  const ffmpegPath = await getFfmpegBinaryPath();
  if (!ffmpegPath) throw new FfmpegNotFoundError();

  const masterPath = path.join(outputDir, "master.mpd");
  const args: string[] = ["-y", "-i", inputPath];

  // One video+audio pair per representation
  for (let i = 0; i < presets.length; i++) {
    args.push("-map", "0:v:0", "-map", "0:a:0");
  }

  // Per-stream codec, scale filter, and bitrate
  for (let i = 0; i < presets.length; i++) {
    const p = presets[i]!;
    args.push(
      `-c:v:${i}`,
      p.videoCodec ?? "libx264",
      `-c:a:${i}`,
      p.audioCodec ?? "aac",
      `-filter:v:${i}`,
      buildScaleFilter(p),
      `-b:v:${i}`,
      p.videoBitrate ?? "1000k",
      `-b:a:${i}`,
      p.audioBitrate ?? "128k"
    );
  }

  args.push(
    "-f",
    "dash",
    "-seg_duration",
    String(segmentDuration),
    "-use_template",
    "1",
    "-use_timeline",
    "1",
    "-init_seg_name",
    "init-stream$RepresentationID$.mp4",
    "-media_seg_name",
    "chunk-stream$RepresentationID$-$Number%05d$.m4s",
    masterPath
  );

  const duration = await new Promise<number>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderrBuf = "";
    let totalDuration = 0;

    proc.stderr!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuf += text;

      if (onProgress) {
        // Duration line appears early; capture it once so we can compute percent.
        if (totalDuration === 0) {
          const dm = text.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
          if (dm) totalDuration = parseTimemarkSecs(dm[1]!);
        }
        // Progress lines use \r to overwrite the terminal line; split on both \r and \n.
        for (const segment of text.split(/[\r\n]/).filter(Boolean)) {
          const pm = segment.match(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
          if (pm) {
            const currentTimeSecs = parseTimemarkSecs(pm[1]!);
            const percent =
              totalDuration > 0
                ? Math.min(100, Math.round((currentTimeSecs / totalDuration) * 100))
                : undefined;
            onProgress({ currentTimeSecs, percent });
          }
        }
      }
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new FfmpegNotFoundError());
      } else {
        reject(err);
      }
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg DASH transcode failed (exit ${code})\n${stderrBuf.slice(-2000)}`));
      } else {
        resolve(parseDurationSecs(stderrBuf));
      }
    });
  });

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
