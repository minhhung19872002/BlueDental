import {
  prepareZXingModule,
  readBarcodes,
  type Position,
  type ReaderOptions,
} from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { DecodeRequest, DecodeResponse, QrCorners } from "./qrDecoder";

// Served from our own origin rather than the library's default CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? wasmUrl : prefix + path,
  },
});

/**
 * Two efforts. The fast one runs on every camera frame on a reduced copy — it
 * is what keeps the box glued to the code as the card moves. The thorough one
 * works the full frame, and only when the fast one has lost the code or found
 * it without being able to read it.
 *
 * `returnErrors` keeps a code ZXing found but could not read yet: its corners
 * are where the box goes and where the zoomed second look is taken. Mirrored
 * codes (some phone-as-webcam drivers flip the picture) are read by ZXing's QR
 * reader itself. The card's text is Vietnamese with no ECI, hence UTF-8.
 */
const FAST: ReaderOptions = {
  formats: ["QRCode"],
  tryHarder: false,
  tryRotate: false,
  tryInvert: false,
  tryDownscale: false,
  maxNumberOfSymbols: 1,
  returnErrors: true,
  characterSet: "UTF8",
};

const THOROUGH: ReaderOptions = { ...FAST, tryHarder: true, tryRotate: true, tryDownscale: true };

const FAST_SIDE = 1280;
const FULL_SIDE = 1920;
/** How wide the zoomed-in copy of a found-but-unread code is drawn. */
const ZOOM_TARGET = 640;
const ZOOM_MARGIN = 0.3;

type Point = { x: number; y: number };

/** The source at no more than `maxSide` pixels a side, as pixels ZXing reads. */
function pixelsOf(source: ImageBitmap | ImageData, maxSide: number): ImageData {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  if (source instanceof ImageData && scale === 1) return source;

  const canvas = new OffscreenCanvas(
    Math.round(source.width * scale),
    Math.round(source.height * scale),
  );
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D canvas unavailable");

  if (source instanceof ImageData) {
    const whole = new OffscreenCanvas(source.width, source.height);
    whole.getContext("2d")?.putImageData(source, 0, 0);
    context.drawImage(whole, 0, 0, canvas.width, canvas.height);
  } else {
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Corners as fractions of the frame, so any copy of it can place them. */
function normalized(position: Position, image: ImageData): QrCorners {
  const { topLeft, topRight, bottomRight, bottomLeft } = position;
  return [topLeft, topRight, bottomRight, bottomLeft].map((p) => ({
    x: p.x / image.width,
    y: p.y / image.height,
  }));
}

/**
 * A second look at a code ZXing located but could not read: the area around
 * it, cut from the full frame and enlarged, so each module spans several
 * pixels instead of one or two.
 */
async function readZoomed(image: ImageData, corners: QrCorners): Promise<string | null> {
  const points: Point[] = corners.map((p) => ({ x: p.x * image.width, y: p.y * image.height }));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const margin = side * ZOOM_MARGIN;
  const sx = Math.max(0, Math.min(...xs) - margin);
  const sy = Math.max(0, Math.min(...ys) - margin);
  const sw = Math.min(image.width - sx, side + 2 * margin);
  const sh = Math.min(image.height - sy, side + 2 * margin);
  if (sw <= 0 || sh <= 0) return null;

  const whole = new OffscreenCanvas(image.width, image.height);
  whole.getContext("2d")?.putImageData(image, 0, 0);

  const scale = Math.max(1, ZOOM_TARGET / Math.max(sw, sh));
  const zoom = new OffscreenCanvas(Math.round(sw * scale), Math.round(sh * scale));
  const context = zoom.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(whole, sx, sy, sw, sh, 0, 0, zoom.width, zoom.height);

  const [result] = await readBarcodes(
    context.getImageData(0, 0, zoom.width, zoom.height),
    THOROUGH,
  );
  return result?.isValid ? result.text : null;
}

async function decode({ source, thorough }: DecodeRequest) {
  const fast = pixelsOf(source, FAST_SIDE);
  const [quick] = await readBarcodes(fast, FAST);
  let corners = quick ? normalized(quick.position, fast) : null;
  let text = quick?.isValid ? quick.text : null;

  if (!text && (corners || thorough)) {
    const full = pixelsOf(source, FULL_SIDE);
    if (!corners) {
      const [careful] = await readBarcodes(full, THOROUGH);
      corners = careful ? normalized(careful.position, full) : null;
      text = careful?.isValid ? careful.text : null;
    }
    if (!text && corners) text = await readZoomed(full, corners);
  }
  return { text, corners };
}

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, source } = event.data;
  let response: DecodeResponse;
  try {
    response = { id, ...(await decode(event.data)), error: null };
  } catch (error) {
    response = {
      id,
      text: null,
      corners: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (source instanceof ImageBitmap) source.close();
  }
  self.postMessage(response);
};
