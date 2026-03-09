import { NextResponse } from "next/server";
import { createBetterMedia } from "better-media";
import { memoryStorage } from "@better-media/adapter-storage";
import { memoryDatabase } from "@better-media/adapter-db";
import { validationPlugin } from "@better-media/plugin-validation";
import { virusScanPlugin } from "@better-media/plugin-virus-scan";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

const media = createBetterMedia({
  storage: memoryStorage(),
  database: memoryDatabase(),
  plugins: [validationPlugin(), virusScanPlugin(), mediaProcessingPlugin()],
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fileKey = body.fileKey ?? `file-${Date.now()}`;
    const metadata = body.metadata ?? {};
    await media.processUpload(fileKey, metadata);
    return NextResponse.json({ success: true, fileKey });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
