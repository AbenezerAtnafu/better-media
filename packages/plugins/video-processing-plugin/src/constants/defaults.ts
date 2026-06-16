import type { ThumbnailPreset } from "../interfaces/options.interface";

export const DEFAULT_THUMBNAIL_PRESETS: ThumbnailPreset[] = [
  { at: "10%", format: "jpeg", width: 640 },
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
