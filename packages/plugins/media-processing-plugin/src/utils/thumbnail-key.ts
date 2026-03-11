import path from "node:path";

/**
 * Option 1: Same directory, suffixed filename.
 * uploads/abcd/original.jpg → uploads/abcd/original-150x150.jpg
 */
export function thumbnailStorageKey(
  fileKey: string,
  width: number,
  height: number | undefined,
  ext: string
): string {
  const dir = path.dirname(fileKey);
  const basename = path.basename(fileKey, path.extname(fileKey));
  const sizeSuffix = height != null ? `${width}x${height}` : `${width}`;
  const name = `${basename}-${sizeSuffix}.${ext}`;
  return dir && dir !== "." ? `${dir}/${name}` : name;
}
