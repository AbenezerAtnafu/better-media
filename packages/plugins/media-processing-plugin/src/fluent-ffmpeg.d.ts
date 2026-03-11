declare module "fluent-ffmpeg" {
  interface FfprobeData {
    format?: { format_name?: string; duration?: string; [key: string]: unknown };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      codec_name?: string;
      r_frame_rate?: string;
      [key: string]: unknown;
    }>;
  }

  interface ScreenshotsOptions {
    timestamps?: string[];
    filename?: string;
    folder?: string;
    size?: string;
  }

  interface FfmpegCommand {
    ffprobe(path: string, callback: (err: Error | null, data: FfprobeData) => void): void;
    screenshots(options: ScreenshotsOptions): FfmpegCommand;
    on(event: string, callback: () => void): FfmpegCommand;
  }

  function ffmpeg(path?: string): FfmpegCommand;
  namespace ffmpeg {
    function ffprobe(path: string, callback: (err: Error | null, data: FfprobeData) => void): void;
  }

  export = ffmpeg;
}
