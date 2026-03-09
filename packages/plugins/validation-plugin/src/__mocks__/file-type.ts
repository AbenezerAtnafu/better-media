export async function fileTypeFromBuffer(): Promise<{ mime: string; ext: string } | undefined> {
  return { mime: "image/jpeg", ext: "jpg" };
}
