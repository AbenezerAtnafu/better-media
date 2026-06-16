import type { ThumbnailPreset, TranscodePreset } from "../interfaces/options.interface";

export interface VideoProbeResult {
  duration: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  framerate?: number;
  bitrate?: number;
}

async function tryImportFfmpeg(): Promise<typeof import("fluent-ffmpeg") | null> {
  try {
    const mod = await import("fluent-ffmpeg");
    return mod.default ?? (mod as unknown as typeof import("fluent-ffmpeg"));
  } catch {
    return null;
  }
}

function parseFramerate(str?: string): number | undefined {
  if (!str) return undefined;
  const parts = str.split("/");
  if (parts.length !== 2) return undefined;
  const num = parseFloat(parts[0]!);
  const den = parseFloat(parts[1]!);
  if (!den || !Number.isFinite(num) || !Number.isFinite(den)) return undefined;
  const fps = Math.round((num / den) * 100) / 100;
  return fps > 0 ? fps : undefined;
}

function buildScaleFilter(width?: number, height?: number): string | undefined {
  if (width && height) return `scale=${width}:${height}`;
  if (width) return `scale=${width}:-2`;
  if (height) return `scale=-2:${height}`;
  return undefined;
}

function parseResolution(resolution?: string): { width?: number; height?: number } {
  if (!resolution) return {};
  const match = resolution.match(/^(\d+)x(\d+)$/i);
  if (!match) return {};
  return { width: parseInt(match[1]!, 10), height: parseInt(match[2]!, 10) };
}

export function resolveTimestamp(at: number | string, durationSecs: number): number {
  if (typeof at === "number") return Math.max(0, at);
  if (typeof at === "string" && at.endsWith("%")) {
    const pct = parseFloat(at) / 100;
    return Math.max(0, pct * durationSecs);
  }
  return Math.max(0, parseFloat(at as string) || 0);
}

export async function probeVideo(
  inputPath: string,
  opts: { ffprobePath?: string } = {}
): Promise<VideoProbeResult> {
  const ffmpeg = await tryImportFfmpeg();
  if (!ffmpeg) throw new FfmpegNotFoundError();

  if (opts.ffprobePath) ffmpeg.setFfprobePath(opts.ffprobePath);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err);

      const videoStream = data.streams.find((s) => s.codec_type === "video");
      const audioStream = data.streams.find((s) => s.codec_type === "audio");
      const durationStr = data.format?.duration;

      resolve({
        duration: durationStr ? parseFloat(String(durationStr)) : 0,
        width: videoStream?.width,
        height: videoStream?.height,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name,
        framerate: parseFramerate(videoStream?.r_frame_rate),
        bitrate: data.format?.bit_rate ? parseInt(String(data.format.bit_rate), 10) : undefined,
      });
    });
  });
}

export async function extractThumbnail(
  inputPath: string,
  outputPath: string,
  preset: ThumbnailPreset,
  durationSecs: number,
  opts: { ffmpegPath?: string } = {}
): Promise<{ width?: number; height?: number }> {
  const ffmpeg = await tryImportFfmpeg();
  if (!ffmpeg) throw new FfmpegNotFoundError();

  const seekSecs = resolveTimestamp(preset.at, durationSecs);
  const format = preset.format ?? "jpeg";
  const scaleFilter = buildScaleFilter(preset.width, preset.height);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath);
    if (opts.ffmpegPath) cmd.setFfmpegPath(opts.ffmpegPath);

    cmd.seekInput(seekSecs).outputOptions(["-vframes", "1"]);

    if (scaleFilter) cmd.videoFilter(scaleFilter);

    if (format === "webp") {
      cmd.videoCodec("libwebp").outputOptions(["-quality", "85"]);
    } else if (format === "png") {
      cmd.outputFormat("image2").videoCodec("png");
    } else {
      cmd.outputFormat("image2").videoCodec("mjpeg").outputOptions(["-q:v", "2"]);
    }

    cmd.output(outputPath);
    cmd.on("error", (err: Error) => reject(err));
    cmd.on("end", () => resolve({ width: preset.width, height: preset.height }));
    cmd.run();
  });
}

export async function transcodeVideo(
  inputPath: string,
  outputPath: string,
  preset: TranscodePreset,
  opts: { ffmpegPath?: string } = {}
): Promise<{ duration: number }> {
  const ffmpeg = await tryImportFfmpeg();
  if (!ffmpeg) throw new FfmpegNotFoundError();

  const videoCodec = preset.videoCodec ?? (preset.format === "webm" ? "libvpx-vp9" : "libx264");
  const audioCodec = preset.audioCodec ?? (preset.format === "webm" ? "libopus" : "aac");
  const { width, height } = parseResolution(preset.resolution);
  const scaleFilter = buildScaleFilter(width, height);

  let duration = 0;

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath);
    if (opts.ffmpegPath) cmd.setFfmpegPath(opts.ffmpegPath);

    cmd.videoCodec(videoCodec).audioCodec(audioCodec);

    if (preset.videoBitrate) cmd.videoBitrate(preset.videoBitrate);
    if (preset.audioBitrate) cmd.audioBitrate(preset.audioBitrate);
    if (scaleFilter) cmd.videoFilter(scaleFilter);

    cmd.output(outputPath);
    cmd.on("error", (err: Error) => reject(err));
    cmd.on("codecData", (data: { duration?: string }) => {
      if (data.duration) {
        const parts = data.duration.split(":").map(Number);
        duration = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
      }
    });
    cmd.on("end", () => resolve({ duration }));
    cmd.run();
  });
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
