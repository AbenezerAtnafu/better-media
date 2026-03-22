export async function fileTypeFromBuffer(
  buffer: Buffer
): Promise<{ mime: string; ext: string } | undefined> {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  return undefined;
}
