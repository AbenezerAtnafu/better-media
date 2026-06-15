import type { AudioPreset } from "../interfaces/options.interface";

export const DEFAULT_AUDIO_PRESETS: AudioPreset[] = [
  { name: "high", bitrate: "192k", codec: "aac" },
  { name: "medium", bitrate: "128k", codec: "aac" },
  { name: "low", bitrate: "96k", codec: "aac" },
];

export const DEFAULT_AUDIO_MIME_TYPES: string[] = [
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
  "audio/x-flac",
  "audio/x-wav",
  "audio/mp3",
  "audio/x-m4a",
];
