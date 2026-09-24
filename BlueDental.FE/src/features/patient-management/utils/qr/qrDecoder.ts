import QrDecodeWorker from "./qrDecode.worker?worker";

/**
 * A QR's four corners — top-left, top-right, bottom-right, bottom-left — as
 * fractions (0–1) of the frame's width and height.
 */
export type QrCorners = { x: number; y: number }[];

export interface DecodeRequest {
  id: number;
  /** A camera frame (handed over, not copied) or a photo's pixels. */
  source: ImageBitmap | ImageData;
  /** Work the full frame too — used while no code is being tracked. */
  thorough: boolean;
}

export interface DecodeResponse {
  id: number;
  text: string | null;
  /** Where a QR was found, read or not. Null when there was none. */
  corners: QrCorners | null;
  /** Set when the decoder itself failed (e.g. the WASM did not load). */
  error: string | null;
}

/** Photos are scaled to this before they are handed to the decoder. */
const PHOTO_SIDE = 1920;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (response: DecodeResponse) => void>();

function decoder(): Worker {
  if (worker) return worker;

  worker = new QrDecodeWorker();
  worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
    pending.get(event.data.id)?.(event.data);
    pending.delete(event.data.id);
  };
  worker.onerror = (event) => {
    for (const [id, resolve] of pending) {
      resolve({ id, text: null, corners: null, error: event.message });
    }
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function send(
  source: ImageBitmap | ImageData,
  thorough: boolean,
  transfer: Transferable[],
): Promise<DecodeResponse> {
  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    decoder().postMessage({ id, source, thorough } satisfies DecodeRequest, transfer);
  });
}

/** Starts loading the decoder so the first frame does not wait for it. */
export function warmUpQrDecoder(): void {
  decoder();
}

/**
 * Reads the frame the video is showing now. The frame travels to the worker as
 * a bitmap — nothing is copied on the page's own thread, which is what lets the
 * camera be read continuously without the dialog stuttering.
 */
export async function decodeVideoFrame(
  video: HTMLVideoElement,
  thorough: boolean,
): Promise<DecodeResponse> {
  const bitmap = await createImageBitmap(video);
  return send(bitmap, thorough, [bitmap]);
}

/** Draws a picture onto a canvas at no more than `maxSide` a side. */
export function drawScaled(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxSide: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Reads the QR off a photo of the card. */
export async function decodeQrFile(file: Blob): Promise<DecodeResponse> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = drawScaled(bitmap, bitmap.width, bitmap.height, PHOTO_SIDE);
    const image = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
    if (!image) return { id: 0, text: null, corners: null, error: null };
    return send(image, true, [image.data.buffer]);
  } finally {
    bitmap.close();
  }
}
