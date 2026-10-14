import type { Item, Point } from "./sketch";

/**
 * The items of a drawing, carried inside its own PNG.
 *
 * A saved drawing is one picture on the sheet and one file in storage; for it
 * to open again as strokes and words that can be picked out and changed, the
 * items travel in a `tEXt` chunk of that same file. Any viewer ignores the
 * chunk, the server still sees a PNG, and nothing else has to be stored.
 */

const KEYWORD = "bluedental-sketch";
const VERSION = 1;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(text);
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let at = 0; at < raw.length; at += 1) bytes[at] = raw.charCodeAt(at);
  return bytes;
}

const round = ({ x, y }: Point): Point => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });

function compact(item: Item): Item {
  if (item.kind === "stroke") return { ...item, points: item.points.map(round) };
  if (item.kind === "shape") return { ...item, from: round(item.from), to: round(item.to) };
  return { ...item, at: round(item.at) };
}

/** The PNG with the items written into it, just before its end. */
export function withItems(pngDataUrl: string, items: readonly Item[]): string {
  const png = fromBase64(pngDataUrl.slice(pngDataUrl.indexOf(",") + 1));
  // ASCII only in a tEXt chunk; the words on the drawing are Vietnamese.
  const text = encodeURIComponent(JSON.stringify({ v: VERSION, items: items.map(compact) }));
  const data = new TextEncoder().encode(`${KEYWORD}\0${text}`);

  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(new TextEncoder().encode("tEXt"), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));

  // IEND is always the last 12 bytes.
  const end = png.length - 12;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, end), 0);
  out.set(chunk, end);
  out.set(png.subarray(end), end + chunk.length);
  return `data:image/png;base64,${toBase64(out)}`;
}

function isPoint(value: unknown): value is Point {
  const point = value as Point;
  return typeof point?.x === "number" && typeof point?.y === "number";
}

/** Only items this pad could have drawn; the file came back from storage. */
function isItem(value: unknown): value is Item {
  const item = value as Item;
  if (typeof item?.id !== "string" || typeof item.color !== "string") return false;
  if (item.kind === "stroke") return Array.isArray(item.points) && item.points.every(isPoint);
  if (item.kind === "shape") return isPoint(item.from) && isPoint(item.to);
  if (item.kind === "text") return typeof item.text === "string" && isPoint(item.at) && typeof item.style === "object";
  return false;
}

/** The items written into a PNG, or null when it carries none. */
export function itemsIn(png: Uint8Array): Item[] | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const decoder = new TextDecoder("latin1");

  for (let at = 8; at + 12 <= png.length; ) {
    const length = view.getUint32(at);
    const type = decoder.decode(png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "tEXt") {
      const text = decoder.decode(data);
      if (text.startsWith(`${KEYWORD}\0`)) {
        try {
          const parsed: unknown = JSON.parse(decodeURIComponent(text.slice(KEYWORD.length + 1)));
          const items = (parsed as { items?: unknown }).items;
          return Array.isArray(items) ? items.filter(isItem) : null;
        } catch {
          // A chunk that cannot be read leaves the drawing as a flat picture.
          return null;
        }
      }
    }
    at += 12 + length;
  }
  return null;
}

/** The items inside a saved drawing or an unsaved one, read off its bytes. */
export async function readItems(source: string): Promise<Item[] | null> {
  if (source.startsWith("data:")) return itemsIn(fromBase64(source.slice(source.indexOf(",") + 1)));
  const response = await fetch(source, { credentials: "include" });
  if (!response.ok) throw new Error(`drawing ${response.status}`);
  return itemsIn(new Uint8Array(await response.arrayBuffer()));
}
