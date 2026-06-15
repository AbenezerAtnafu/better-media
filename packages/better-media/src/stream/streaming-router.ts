import type { IncomingMessage, ServerResponse } from "node:http";
import type { BetterMediaRuntime } from "../runtime/runtime.interface";
import type { StreamingRouterOptions } from "./stream.interface";

function mimeForPath(filePath: string): string {
  if (filePath.endsWith(".m3u8")) return "application/x-mpegURL";
  if (filePath.endsWith(".mpd")) return "application/dash+xml";
  if (filePath.endsWith(".ts")) return "video/MP2T";
  if (filePath.endsWith(".m4s")) return "video/iso.segment";
  if (filePath.endsWith(".mp4")) return "video/mp4";
  if (filePath.endsWith(".aac")) return "audio/aac";
  if (filePath.endsWith(".mp3")) return "audio/mpeg";
  if (filePath.endsWith(".opus")) return "audio/ogg";
  return "application/octet-stream";
}

function parsePath(req: IncomingMessage & { path?: string }): string {
  // Express sets req.path relative to the mount point; fall back to req.url
  const raw = req.path ?? req.url ?? "/";
  // Strip query string
  return raw.split("?")[0] ?? "/";
}

/**
 * Creates a Connect-compatible middleware that proxies HLS/DASH/progressive
 * segments from storage to the client.
 *
 * Mount it in Express:
 * ```ts
 * app.use("/stream", createStreamingRouter(media, { derivativePrefix: "streaming" }));
 * // Player URL: https://yourapp.com/stream/{recordId}/hls/master.m3u8
 * ```
 *
 * The path after the mount point must be:
 *   /{recordId}/{format}/{...subpath}
 * e.g.  /abc123/hls/master.m3u8
 *       /abc123/hls/360p/seg000.ts
 *       /abc123/progressive/high.aac
 */
export function createStreamingRouter(
  media: BetterMediaRuntime,
  options: StreamingRouterOptions = {}
): (
  req: IncomingMessage & { path?: string },
  res: ServerResponse,
  next?: (err?: unknown) => void
) => Promise<void> {
  const prefix = options.derivativePrefix ?? "streaming";

  return async (req, res, next) => {
    const reqPath = parsePath(req).replace(/^\//, "");
    const parts = reqPath.split("/");

    if (parts.length < 2 || !parts[0]) {
      res.statusCode = 400;
      res.end("Bad Request: path must be /{recordId}/{subpath}");
      return;
    }

    const recordId = parts[0];
    const subpath = parts.slice(1).join("/");

    if (!subpath) {
      res.statusCode = 400;
      res.end("Bad Request: missing subpath");
      return;
    }

    // Auth gate
    if (options.onRequest) {
      let allowed: boolean;
      try {
        allowed = await options.onRequest(recordId, subpath, req);
      } catch {
        res.statusCode = 500;
        res.end("Internal Server Error");
        return;
      }
      if (!allowed) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }
    }

    const storageKey = `${prefix}/${recordId}/${subpath}`;

    let buffer: Buffer | null;
    try {
      buffer = await media.files.download(storageKey);
    } catch (err) {
      if (next) {
        next(err);
      } else {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
      return;
    }

    if (buffer == null) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    res.setHeader("Content-Type", mimeForPath(subpath));
    res.setHeader("Content-Length", buffer.length);
    // Allow players to cache segments; playlists should revalidate
    if (subpath.endsWith(".m3u8") || subpath.endsWith(".mpd")) {
      res.setHeader("Cache-Control", "no-cache");
    } else {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    res.statusCode = 200;
    res.end(buffer);
  };
}
