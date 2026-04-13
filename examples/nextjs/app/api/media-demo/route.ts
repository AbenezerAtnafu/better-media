import { NextResponse } from "next/server";
import { database } from "@/lib/media";

/**
 * Inspect in-memory DB after uploads / jobs (demo only).
 * Shows `media` rows and `media_versions` (e.g. Sharp thumbnails).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");

    const mediaRows = await database.findMany({
      model: "media",
      where: mediaId ? [{ field: "id", value: mediaId }] : undefined,
      sortBy: { field: "createdAt", direction: "desc" },
      limit: mediaId ? 1 : 8,
    });

    const versionWhere = mediaId ? [{ field: "mediaId", value: mediaId }] : undefined;

    const versions = await database.findMany({
      model: "media_versions",
      where: versionWhere,
      sortBy: { field: "createdAt", direction: "desc" },
      limit: 24,
    });

    return NextResponse.json({
      media: mediaRows,
      media_versions: versions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
