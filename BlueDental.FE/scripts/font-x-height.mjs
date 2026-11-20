// The x-height the carried sheet face reports (R-1262, public/fonts/tinos).
//
//   node scripts/font-x-height.mjs read <.ttf|.woff2 files...>
//   node scripts/font-x-height.mjs patch <sxHeight> <.woff2 files...>
//
// Reads / sets OS/2 sxHeight. sfnt (.ttf) read only; .woff2 read + patch
// (OS/2 is never transformed in WOFF2, so its bytes sit raw in the stream).
//
// Tinos is drawn to Times New Roman's widths but stands its lower case taller
// (sxHeight 940 against 916), and the sheets' font-size-adjust (R-1234) sizes
// letters by that number: Tinos came out 2.6% smaller than Times New Roman.
// Each Tinos style carries its Times New Roman counterpart's sxHeight instead:
//   400 normal 916, 700 normal 935, 400 italic 881, 700 italic 899.
/* global console */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import process from "node:process";
import zlib from "node:zlib";

const KNOWN = ["cmap","head","hhea","hmtx","maxp","name","OS/2","post","cvt ","fpgm","glyf","loca","prep","CFF ","VORG","EBDT","EBLC","gasp","hdmx","kern","LTSH","PCLT","VDMX","vhea","vmtx","BASE","GDEF","GPOS","GSUB","EBSC","JSTF","MATH","CBDT","CBLC","COLR","CPAL","SVG ","sbix","acnt","avar","bdat","bloc","bsln","cvar","fdsc","feat","fmtx","fvar","gvar","hsty","just","lcar","mort","morx","opbd","prop","trak","Zapf","Silf","Glat","Gloc","Feat","Sill"];

function base128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.p++];
    v = (v << 7) | (b & 0x7f);
    if (!(b & 0x80)) return v >>> 0;
  }
  throw new Error("bad base128");
}

function sfntTables(buf) {
  const n = buf.readUInt16BE(4);
  const out = {};
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    out[buf.toString("latin1", o, o + 4)] = { off: buf.readUInt32BE(o + 8), len: buf.readUInt32BE(o + 12) };
  }
  return out;
}

function woff2(buf) {
  if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error("not woff2");
  const numTables = buf.readUInt16BE(12);
  const compLen = buf.readUInt32BE(20);
  const metaOffset = buf.readUInt32BE(28), privOffset = buf.readUInt32BE(40);
  if (metaOffset || privOffset) throw new Error("meta/priv blocks not handled");
  const pos = { p: 48 };
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos.p++];
    let tag = KNOWN[flags & 0x3f];
    if ((flags & 0x3f) === 0x3f) { tag = buf.toString("latin1", pos.p, pos.p + 4); pos.p += 4; }
    const version = flags >> 6;
    const orig = base128(buf, pos);
    const hasT = (tag === "glyf" || tag === "loca") ? version === 0 : version !== 0;
    const len = hasT ? base128(buf, pos) : orig;
    dir.push({ tag, len });
  }
  const streamStart = pos.p;
  const data = zlib.brotliDecompressSync(buf.subarray(streamStart, streamStart + compLen));
  let off = 0;
  const tables = {};
  for (const t of dir) { tables[t.tag] = { off, len: t.len }; off += t.len; }
  if (off !== data.length) throw new Error(`stream size ${data.length} != ${off}`);
  return { streamStart, data, tables };
}

function metrics(data, tables) {
  const os2 = tables["OS/2"].off, head = tables.head.off;
  return {
    upem: data.readUInt16BE(head + 18),
    os2Version: data.readUInt16BE(os2),
    sxHeight: data.readInt16BE(os2 + 86),
    sCapHeight: data.readInt16BE(os2 + 88),
  };
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "read") {
  for (const f of rest) {
    const buf = fs.readFileSync(f);
    const m = f.endsWith(".woff2") ? (() => { const w = woff2(buf); return metrics(w.data, w.tables); })() : metrics(buf, sfntTables(buf));
    console.log(f.split(/[\\/]/).pop(), JSON.stringify(m), "xh=" + (m.sxHeight / m.upem).toFixed(4));
  }
} else if (mode === "patch") {
  const value = Number(rest.shift());
  for (const f of rest) {
    const buf = fs.readFileSync(f);
    const w = woff2(buf);
    const at = w.tables["OS/2"].off + 86;
    const was = w.data.readInt16BE(at);
    w.data.writeInt16BE(value, at);
    const comp = zlib.brotliCompressSync(w.data, {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_FONT,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: w.data.length,
      },
    });
    const head = Buffer.from(buf.subarray(0, w.streamStart));
    head.writeUInt32BE(comp.length, 20);
    const pad = (4 - ((head.length + comp.length) % 4)) % 4;
    const out = Buffer.concat([head, comp, Buffer.alloc(pad)]);
    out.writeUInt32BE(out.length, 8);
    fs.writeFileSync(f, out);
    console.log(f.split(/[\\/]/).pop(), `sxHeight ${was} -> ${value}`, `${buf.length} -> ${out.length} bytes`);
  }
}
