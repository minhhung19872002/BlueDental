import { zipSync } from "fflate";

export interface NamedFile {
  fileName: string;
  blob: Blob;
}

/** "a.jpg", "a.jpg" → "a.jpg", "a (2).jpg": a zip keeps only one entry per name. */
export function uniqueFileNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const name = raw.trim() || "file";
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/**
 * Packs files into one .zip. Stored, not deflated: photos are compressed
 * already, so deflating only costs time.
 */
export async function zipFiles(files: NamedFile[]): Promise<Blob> {
  const names = uniqueFileNames(files.map((file) => file.fileName));
  const entries: Record<string, Uint8Array> = {};
  const contents = await Promise.all(files.map((file) => file.blob.arrayBuffer()));
  names.forEach((name, index) => {
    entries[name] = new Uint8Array(contents[index]);
  });
  // slice(): fflate types its output over ArrayBufferLike, which Blob does not take.
  const zipped = zipSync(entries, { level: 0 }).slice();
  return new Blob([zipped], { type: "application/zip" });
}
