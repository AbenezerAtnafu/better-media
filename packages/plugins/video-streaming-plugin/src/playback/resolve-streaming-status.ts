import type { StorageAdapter } from "@better-media/core";

export interface StreamingStatus {
  /** Whether the HLS master playlist is ready in storage. */
  hls: boolean;
  /** Whether the DASH master manifest is ready in storage. */
  dash: boolean;
  /** True when at least one format is ready for playback. */
  ready: boolean;
}

export interface ResolveStreamingStatusOptions {
  storage: StorageAdapter;
  /** Storage key prefix used at transcode time. Default: "streaming". */
  derivativePrefix?: string;
}

export async function resolveStreamingStatus(
  recordId: string,
  options: ResolveStreamingStatusOptions
): Promise<StreamingStatus> {
  const { storage, derivativePrefix = "streaming" } = options;

  const [hls, dash] = await Promise.all([
    storage.exists(`${derivativePrefix}/${recordId}/hls/master.m3u8`),
    storage.exists(`${derivativePrefix}/${recordId}/dash/master.mpd`),
  ]);

  return { hls, dash, ready: hls || dash };
}
