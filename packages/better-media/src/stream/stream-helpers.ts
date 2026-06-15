import type { DatabaseAdapter, StorageAdapter } from "@better-media/core";
import type {
  PlaybackUrl,
  PlaybackUrlOptions,
  StreamingFormat,
  StreamingVariant,
} from "./stream.interface";

function isMasterKey(storageKey: string): boolean {
  return (
    storageKey.endsWith("master.m3u8") ||
    storageKey.endsWith("master.mpd") ||
    // Progressive: each preset file is its own deliverable (no master playlist)
    (storageKey.includes("/progressive/") && !storageKey.endsWith("/progressive/"))
  );
}

function formatFromKey(storageKey: string): StreamingFormat {
  if (storageKey.endsWith(".m3u8") || storageKey.includes("/hls/")) return "hls";
  if (storageKey.endsWith(".mpd") || storageKey.includes("/dash/")) return "dash";
  return "progressive";
}

async function queryMasters(
  database: DatabaseAdapter,
  recordId: string
): Promise<Array<{ storageKey: string; mimeType: string }>> {
  const rows = await database.findMany<{ storageKey: string; mimeType: string }>({
    model: "media_versions",
    where: [
      { field: "mediaId", value: recordId },
      { field: "type", value: "compressed", connector: "AND" },
    ],
    select: ["storageKey", "mimeType"],
  });
  return rows.filter((r) => typeof r.storageKey === "string" && isMasterKey(r.storageKey));
}

async function resolveUrl(
  storage: StorageAdapter,
  storageKey: string,
  expiresIn?: number
): Promise<string | null> {
  if (typeof storage.getUrl !== "function") return null;
  return storage.getUrl(storageKey, expiresIn != null ? { expiresIn } : undefined);
}

export async function getPlaybackUrl(
  database: DatabaseAdapter,
  storage: StorageAdapter,
  recordId: string,
  options: PlaybackUrlOptions = {}
): Promise<PlaybackUrl | null> {
  const masters = await queryMasters(database, recordId);
  if (masters.length === 0) return null;

  const candidates = options.format
    ? masters.filter((r) => formatFromKey(r.storageKey) === options.format)
    : masters;

  const row = candidates[0];
  if (!row) return null;

  if (typeof storage.getUrl !== "function") {
    throw new Error(
      "stream.getPlaybackUrl() requires a storage adapter that supports getUrl() " +
        "(e.g. S3, GCS). For local/memory storage, use createStreamingRouter() to proxy " +
        "segments through your server instead."
    );
  }

  const url = await storage.getUrl(
    row.storageKey,
    options.expiresIn != null ? { expiresIn: options.expiresIn } : undefined
  );

  return {
    format: formatFromKey(row.storageKey),
    masterKey: row.storageKey,
    url,
  };
}

export async function getVariants(
  database: DatabaseAdapter,
  storage: StorageAdapter,
  recordId: string,
  options: Pick<PlaybackUrlOptions, "expiresIn"> = {}
): Promise<StreamingVariant[]> {
  const masters = await queryMasters(database, recordId);

  return Promise.all(
    masters.map(async (row) => ({
      format: formatFromKey(row.storageKey),
      masterKey: row.storageKey,
      mimeType: row.mimeType ?? "application/octet-stream",
      url: await resolveUrl(storage, row.storageKey, options.expiresIn),
    }))
  );
}
