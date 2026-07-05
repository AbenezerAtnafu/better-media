import type { DatabaseAdapter } from "@better-media/core";
import type { StorageAdapter } from "@better-media/core";

export interface StreamingUrlResult {
  /** Master HLS playlist URL, if HLS was generated for this record. */
  hls?: string;
  /** Master DASH manifest URL, if DASH was generated for this record. */
  dash?: string;
}

export interface ResolveStreamingUrlsOptions {
  database: DatabaseAdapter;
  storage: StorageAdapter;
  /** When set, generates a signed URL expiring in this many seconds. */
  expiresIn?: number;
  /** Storage key prefix used at transcode time. Default: "streaming". */
  derivativePrefix?: string;
}

const HLS_MIME = "application/x-mpegURL";
const DASH_MIME = "application/dash+xml";

export async function resolveStreamingUrls(
  recordId: string,
  options: ResolveStreamingUrlsOptions
): Promise<StreamingUrlResult> {
  const { database, storage, expiresIn, derivativePrefix = "streaming" } = options;

  if (!storage.getUrl) {
    throw new Error(
      "resolveStreamingUrls requires storage.getUrl to be implemented. " +
        "The memory adapter does not support URL generation — use createStreamingProxy instead."
    );
  }

  const rows = await database.findMany<{ storageKey: string; mimeType: string }>({
    model: "media_versions",
    where: [
      { field: "mediaId", value: recordId },
      { field: "mimeType", value: [HLS_MIME, DASH_MIME], operator: "in" },
    ],
    select: ["storageKey", "mimeType"],
  });

  const keyPrefix = `${derivativePrefix}/${recordId}/`;
  const masters = rows.filter(
    (r) =>
      r.storageKey.startsWith(keyPrefix) &&
      (r.storageKey.endsWith("master.m3u8") || r.storageKey.endsWith("master.mpd"))
  );

  const result: StreamingUrlResult = {};

  for (const row of masters) {
    const url = await storage.getUrl!(
      row.storageKey,
      expiresIn !== undefined ? { expiresIn } : undefined
    );

    if (row.mimeType === HLS_MIME) {
      result.hls = url;
    } else if (row.mimeType === DASH_MIME) {
      result.dash = url;
    }
  }

  return result;
}
