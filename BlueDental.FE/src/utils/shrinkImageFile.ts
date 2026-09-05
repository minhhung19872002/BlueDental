/** Longest side a photograph is scaled down to before upload, as the reference does. */
export const IMAGE_MAX_SIDE = 1600;
/** Files under this size and inside the side limit go up untouched. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function decode(file: File): Promise<ImageBitmap | null> {
  return createImageBitmap(file).catch(() => null);
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
}

/**
 * Scales a photograph down to at most 1600px on its longest side when it is
 * bigger than that or heavier than 5 MB, so a phone camera's 12 MP shot does
 * not go to the server as-is. Anything that cannot be decoded — or already
 * fits — is returned unchanged; the server still validates the type.
 *
 * PNGs stay PNG so transparent screenshots keep their alpha; everything else
 * comes out as JPEG.
 */
export async function shrinkImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await decode(file);
  if (!bitmap) return file;

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= IMAGE_MAX_SIDE && file.size <= IMAGE_MAX_BYTES) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, IMAGE_MAX_SIDE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await encode(canvas, type);
  if (!blob) return file;

  const name = type === "image/jpeg" ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
  return new File([blob], name, { type, lastModified: file.lastModified });
}
