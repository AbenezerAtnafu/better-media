import { NextResponse } from "next/server";
import { getMedia } from "@/lib/media";

// Minimal valid JPEG (JSON demo only; validation reads from storage)
const SAMPLE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0x7f, 0xff, 0xd9,
]);

export async function POST(request: Request) {
  try {
    const media = getMedia();
    const ct = request.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
        return NextResponse.json(
          { success: false, error: "Expected a file field named `file`." },
          { status: 400 }
        );
      }

      const buf = Buffer.from(await file.arrayBuffer());
      const keyField = form.get("fileKey");
      const key =
        (typeof keyField === "string" && keyField.trim() !== ""
          ? keyField
          : `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`) || `upload-${Date.now()}.bin`;

      const result = await media.upload.fromBuffer(buf, {
        key,
        metadata: {
          contentType: file.type || "application/octet-stream",
          originalName: file.name,
          size: file.size,
        },
      });

      return NextResponse.json({
        success: true,
        fileKey: result.key,
        mediaId: result.id,
        source: "multipart",
      });
    }

    const body = await request.json();
    const fileKey = body.fileKey ?? `photo-${Date.now()}.jpg`;
    const metadata = body.metadata ?? { contentType: "image/jpeg" };
    const simulateFail = body.simulateValidationFail === true;

    const result = await media.upload.fromBuffer(
      simulateFail ? Buffer.from("not-an-image") : SAMPLE_JPEG,
      {
        key: fileKey,
        metadata,
      }
    );

    return NextResponse.json({
      success: true,
      fileKey: result.key,
      mediaId: result.id,
      source: "json-demo",
    });
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
