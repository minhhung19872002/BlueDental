import { foldForSearch } from "@/utils/foldForSearch";

export interface TextSegment {
  text: string;
  hit: boolean;
}

/** One character folded the way the server folds a search (R-1051); "" for a lone mark. */
function foldChar(c: string): string {
  return c
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/**
 * `text` cut into plain and matched pieces, each searched word marked wherever
 * it appears without regard to case or accents: "hen" marks "Hẹn". The match
 * runs on a folded copy and maps back to the original characters, so what is
 * shown keeps its marks.
 */
export function highlightMatches(text: string, query: string): TextSegment[] {
  const terms = [...new Set(foldForSearch(query).split(" ").filter(Boolean))];
  if (terms.length === 0 || !text) return [{ text, hit: false }];

  const chars = Array.from(text);
  let folded = "";
  const owner: number[] = [];
  chars.forEach((c, index) => {
    for (const f of foldChar(c)) {
      folded += f;
      owner.push(index);
    }
  });

  const marked = new Array<boolean>(chars.length).fill(false);
  for (const term of terms) {
    for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + 1)) {
      for (let k = at; k < at + term.length; k++) marked[owner[k]] = true;
    }
  }

  const segments: TextSegment[] = [];
  chars.forEach((c, index) => {
    const last = segments.at(-1);
    if (last && last.hit === marked[index]) last.text += c;
    else segments.push({ text: c, hit: marked[index] });
  });
  return segments;
}
