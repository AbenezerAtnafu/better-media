import type { StreamingPreset } from "../interfaces/options.interface";

export const DEFAULT_STREAMING_PRESETS: StreamingPreset[] = [
  { name: "360p", height: 360, videoBitrate: "800k", audioBitrate: "96k" },
  { name: "720p", height: 720, videoBitrate: "2500k", audioBitrate: "128k" },
  { name: "1080p", height: 1080, videoBitrate: "5000k", audioBitrate: "192k" },
];

export const DEFAULT_VIDEO_MIME_TYPES: string[] = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/mpeg",
  "video/ogg",
  "video/3gpp",
  "video/x-flv",
  "video/x-ms-wmv",
];
