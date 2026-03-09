import { NextResponse } from "next/server";
import { media } from "@/lib/media";

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
