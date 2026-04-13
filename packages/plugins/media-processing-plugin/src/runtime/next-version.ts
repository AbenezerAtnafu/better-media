import type { DatabaseAdapter } from "@better-media/core";

/**
 * Next `versionNumber` for new `media_versions` rows for this media id.
 */
export async function nextMediaVersionStart(
  database: DatabaseAdapter,
  mediaId: string
): Promise<number> {
  const rows = await database.findMany({
    model: "media_versions",
    where: [{ field: "mediaId", value: mediaId }],
    sortBy: { field: "versionNumber", direction: "desc" },
    limit: 1,
  });
  const max = rows[0]?.versionNumber;
  return typeof max === "number" && Number.isFinite(max) ? max + 1 : 1;
}
