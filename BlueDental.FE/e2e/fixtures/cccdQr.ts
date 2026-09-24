import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prepareZXingModule, writeBarcode } from "zxing-wasm/writer";

/**
 * Real CCCD-style QR codes for the "Quét CCCD" specs: a PNG for the photo
 * upload, and a Y4M video Chromium plays as its camera
 * (`--use-file-for-fake-video-capture`). Nothing is stubbed in the page — the
 * app's own decoder reads these pixels.
 */

let prepared = false;

function prepare(): void {
  if (prepared) return;
  const wasm = readFileSync(path.resolve("node_modules/zxing-wasm/dist/writer/zxing_writer.wasm"));
  prepareZXingModule({ overrides: { wasmBinary: new Uint8Array(wasm).buffer } });
  prepared = true;
}

/** The text behind a CCCD's QR: id|old id|name|dob|gender|address|issued. */
export function cardQr(cccd: string, name: string, address: string): string {
  return [cccd, "212345678", name, "15031990", "Nam", address, "01022021"].join("|");
}

/** A photo-like PNG of the QR alone. */
export async function qrPng(text: string): Promise<Buffer> {
  prepare();
  const result = await writeBarcode(text, { format: "QRCode", scale: 6 });
  if (!result.image) throw new Error(result.error || "QR not written");
  return Buffer.from(await result.image.arrayBuffer());
}

interface CameraOptions {
  /** Flip the picture, as some phone-as-webcam drivers do. */
  mirror: boolean;
  /**
   * Spoil the code's data beyond repair while keeping its finder patterns: the
   * camera then finds the QR but can never read it, so the box stays on it.
   */
  unreadable?: boolean;
}

/** Where the QR sits in the fake camera's frame, in frame pixels. */
export interface FakeQrPlacement {
  frameWidth: number;
  frameHeight: number;
  x: number;
  y: number;
  size: number;
}

/**
 * A 1280×720 camera frame of a card held in front of the lens with its QR at
 * the top right — small in the frame, as in real use — written as Y4M.
 */
export async function writeFakeCamera(
  file: string,
  text: string,
  { mirror, unreadable = false }: CameraOptions,
): Promise<FakeQrPlacement> {
  prepare();
  const { symbol } = await writeBarcode(text, { format: "QRCode", scale: 1, addQuietZones: false });
  const n = symbol.width;
  const data = Uint8ClampedArray.from(symbol.data);
  if (unreadable) {
    for (let y = 9; y < n - 9; y++) {
      for (let x = 9; x < n - 9; x++) {
        if ((x * 7 + y * 13) % 3 === 0) data[y * n + x] = 255 - data[y * n + x];
      }
    }
  }

  const W = 1280;
  const H = 720;
  const MODULE = 4;
  const luma = new Uint8Array(W * H).fill(60); // desk

  const card = { x: 300, y: 150, w: 680, h: 430 };
  for (let y = card.y; y < card.y + card.h; y++)
    luma.fill(205, y * W + card.x, y * W + card.x + card.w);

  const size = symbol.width * MODULE;
  const qx = card.x + card.w - size - 40;
  const qy = card.y + 30;
  for (let y = -2 * MODULE; y < size + 2 * MODULE; y++) {
    for (let x = -2 * MODULE; x < size + 2 * MODULE; x++) {
      const mx = Math.floor(x / MODULE);
      const my = Math.floor(y / MODULE);
      const inside = mx >= 0 && my >= 0 && mx < symbol.width && my < symbol.height;
      luma[(qy + y) * W + qx + x] = inside ? data[my * n + mx] : 255;
    }
  }

  if (mirror) {
    for (let y = 0; y < H; y++) luma.subarray(y * W, (y + 1) * W).reverse();
  }

  const chroma = new Uint8Array((W / 2) * (H / 2)).fill(128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), luma, chroma, chroma]);

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]),
  );

  return { frameWidth: W, frameHeight: H, x: mirror ? W - qx - size : qx, y: qy, size };
}
