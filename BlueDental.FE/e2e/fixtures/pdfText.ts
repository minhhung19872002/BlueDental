import { inflateSync } from "node:zlib";

/**
 * The words on each page of a PDF Chromium printed, in the order drawn — enough
 * to say which line a printed page begins with.
 *
 * Chromium (Skia) writes every object uncompressed at top level, its text as
 * glyph ids in hex strings, and a ToUnicode map with each font; nothing here
 * reaches further than that. The page number the sheets carry in their bottom
 * margin comes out as a page's own line of digits.
 */

type Objects = Map<number, string>;

function objectsOf(pdf: Buffer): Objects {
  const text = pdf.toString("latin1");
  const objects: Objects = new Map();
  for (const match of text.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objects.set(Number(match[1]), match[2]);
  return objects;
}

function streamOf(body: string): string {
  const match = /stream\r?\n([\s\S]*)\r?\nendstream/.exec(body);
  if (!match) return "";
  const raw = Buffer.from(match[1], "latin1");
  return body.includes("FlateDecode") ? inflateSync(raw).toString("latin1") : raw.toString("latin1");
}

function refOf(body: string, key: string): number | null {
  const match = new RegExp(`/${key}\\s+(\\d+) 0 R`).exec(body);
  return match ? Number(match[1]) : null;
}

function toUnicode(map: string): Map<number, string> {
  const glyphs = new Map<number, string>();
  const utf16 = (hex: string) => Buffer.from(hex, "hex").swap16().toString("utf16le");
  for (const [, block] of map.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, from, to] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) glyphs.set(parseInt(from, 16), utf16(to));
  }
  for (const [, block] of map.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, start, end, to] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      for (let glyph = parseInt(start, 16); glyph <= parseInt(end, 16); glyph += 1) {
        glyphs.set(glyph, String.fromCodePoint(parseInt(to, 16) + glyph - parseInt(start, 16)));
      }
    }
  }
  return glyphs;
}

function fontsOf(objects: Objects, page: string): Map<string, Map<number, string>> {
  const fonts = new Map<string, Map<number, string>>();
  const resourcesRef = refOf(page, "Resources");
  const resources = resourcesRef === null ? page : (objects.get(resourcesRef) ?? "");
  const fontEntry = /\/Font\s*(<<[\s\S]*?>>|\d+ 0 R)/.exec(resources)?.[1] ?? "";
  const fontDict = fontEntry.endsWith("R") ? (objects.get(Number(fontEntry.split(" ")[0])) ?? "") : fontEntry;
  for (const [, name, id] of fontDict.matchAll(/\/(\w+)\s+(\d+) 0 R/g)) {
    const mapRef = refOf(objects.get(Number(id)) ?? "", "ToUnicode");
    fonts.set(name, mapRef === null ? new Map() : toUnicode(streamOf(objects.get(mapRef) ?? "")));
  }
  return fonts;
}

function textOf(objects: Objects, page: string): string {
  const fonts = fontsOf(objects, page);
  const contents = /\/Contents\s*(\[[\s\S]*?\]|\d+ 0 R)/.exec(page)?.[1] ?? "";
  const drawn = Array.from(contents.matchAll(/(\d+) 0 R/g), ([, id]) => streamOf(objects.get(Number(id)) ?? "")).join("\n");

  let font = new Map<number, string>();
  let out = "";
  for (const op of drawn.matchAll(/\/(\w+)\s+[\d.]+\s+Tf|\[([\s\S]*?)\]\s*TJ|<([0-9A-Fa-f]*)>\s*Tj|(ET)/g)) {
    if (op[1]) font = fonts.get(op[1]) ?? new Map();
    else if (op[4]) out += "\n";
    else {
      const strings = op[2] !== undefined ? Array.from(op[2].matchAll(/<([0-9A-Fa-f]*)>/g), (hex) => hex[1]) : [op[3]];
      for (const hex of strings) {
        for (let at = 0; at < hex.length; at += 4) out += font.get(parseInt(hex.slice(at, at + 4), 16)) ?? "";
      }
    }
  }
  return out.replace(/\n+/g, "\n").trim();
}

/** Each page's text, first page first. */
export function pdfPageTexts(pdf: Buffer): string[] {
  const objects = objectsOf(pdf);
  const tree = Array.from(objects.values()).find((body) => /\/Type\s*\/Pages\b/.test(body)) ?? "";
  const kids = /\/Kids\s*\[([\s\S]*?)\]/.exec(tree)?.[1] ?? "";
  return Array.from(kids.matchAll(/(\d+) 0 R/g), ([, id]) => textOf(objects, objects.get(Number(id)) ?? ""));
}

/** A page's first line of writing — the page number in the margin left out. */
export function firstLineOf(pageText: string): string {
  return pageText.split("\n").find((line) => line.trim() && !/^\d+$/.test(line.trim()))?.trim() ?? "";
}
