/** What a signature picture may be when picked (P2910_02): PNG or JPG, at most 2 MB. */
export const SIGNATURE_IMAGE_ACCEPT = "image/png,image/jpeg";
const SIGNATURE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];
const SIGNATURE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** The box it is drawn into, both on the export column and on the PHIẾU THU. */
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
/** What the server keeps (AccountantSignatureConsts.MaxBytes); past it the picture goes smaller. */
const STORED_MAX_BYTES = 200 * 1024;
const SHRINK_STEP = 0.75;
const SHRINK_TRIES = 4;

const PNG_PREFIX = "data:image/png;base64,";

export type SignatureImageError = "WrongType" | "TooLarge" | "Unreadable";

export type SignatureImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: SignatureImageError };

const bytesOf = (dataUrl: string) => Math.ceil(((dataUrl.length - PNG_PREFIX.length) * 3) / 4);

function drawPng(bitmap: ImageBitmap, scale: number): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/**
 * A picked signature picture made ready to keep: checked (PNG/JPG, ≤ 2 MB),
 * then fitted inside 600×200 and written as PNG — the only kind the server
 * takes. A picture still heavier than the server's 200 KB is drawn smaller
 * a few times before giving up.
 */
export async function signatureImageFrom(file: File): Promise<SignatureImageResult> {
  if (!SIGNATURE_IMAGE_TYPES.includes(file.type)) return { ok: false, error: "WrongType" };
  if (file.size > SIGNATURE_IMAGE_MAX_BYTES) return { ok: false, error: "TooLarge" };

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { ok: false, error: "Unreadable" };

  let scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  try {
    for (let attempt = 0; attempt < SHRINK_TRIES; attempt++) {
      const dataUrl = drawPng(bitmap, scale);
      if (!dataUrl) return { ok: false, error: "Unreadable" };
      if (bytesOf(dataUrl) <= STORED_MAX_BYTES) return { ok: true, dataUrl };
      scale *= SHRINK_STEP;
    }
    return { ok: false, error: "TooLarge" };
  } finally {
    bitmap.close();
  }
}
