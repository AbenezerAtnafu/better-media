import path from "node:path";

/**
 * Nests variants in a dedicated folder named after the original filename (without extension).
 * uploads/abcd/original.jpg → uploads/abcd/original/150x150.jpg
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

  const folderPath = dir && dir !== "." ? `${dir}/${basename}` : basename;
  return `${folderPath}/thumb-${sizeSuffix}.${ext}`;
}
