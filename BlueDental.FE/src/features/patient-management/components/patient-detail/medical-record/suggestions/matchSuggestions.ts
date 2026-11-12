/**
 * Which of a blank's earlier texts to offer for what has been typed so far,
 * the way a search box completes a query: a text that starts with it first,
 * then one with a word that starts with it; within each, the server's order
 * (most patients first). Accents and case do not matter — "sai khop" finds
 * "Sai khớp cắn". One letter is enough. With nothing typed there is no query —
 * unless asked for (Ctrl + Space): then the most used texts, as they come.
 */

export const MAX_SUGGESTIONS = 8;

const COMBINING_MARKS = /[\u0300-\u036f]/g;

export interface Suggestion {
  text: string;
  /** Where in `text` the typed letters sit, and how many — shown unbolded. */
  start: number;
  length: number;
}

/** One UTF-16 unit folded to one unit, so an index in the folded text is the same index in the original. */
function foldUnit(unit: string): string {
  const folded = unit.normalize("NFD").replace(COMBINING_MARKS, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
  return folded.length === 1 ? folded : unit.toLowerCase().charAt(0) || unit;
}

export function fold(text: string): string {
  return text.split("").map(foldUnit).join("");
}

function matchAt(folded: string, query: string): number {
  if (folded.startsWith(query)) return 0;
  const word = folded.indexOf(` ${query}`);
  return word < 0 ? -1 : word + 1;
}

export function matchSuggestions(
  typed: string,
  values: readonly string[],
  { whenEmpty = false, limit = MAX_SUGGESTIONS }: { whenEmpty?: boolean; limit?: number } = {},
): Suggestion[] {
  const query = fold(typed.trimStart());
  if (query.trim().length === 0) {
    return whenEmpty ? values.slice(0, limit).map((text) => ({ text, start: 0, length: 0 })) : [];
  }

  const exact = query.trim();
  const starts: Suggestion[] = [];
  const words: Suggestion[] = [];
  for (const text of values) {
    const folded = fold(text);
    if (folded === exact) continue;
    const start = matchAt(folded, query);
    if (start < 0) continue;
    (start === 0 ? starts : words).push({ text, start, length: query.length });
  }
  return [...starts, ...words].slice(0, limit);
}
