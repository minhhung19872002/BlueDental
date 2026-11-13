/**
 * Which of a blank's earlier texts to offer for what has been typed so far:
 * every text holding it anywhere (owner, 2026-11-13, R-1223 — full text, not
 * only from a word's start), what was typed trimmed at both ends. A text that
 * starts with it comes first, then one with a word that starts with it, then
 * the rest; within each, the server's order (most patients first). Accents and
 * case do not matter — "khop" finds "Sai khớp cắn". One letter is enough.
 * With nothing typed there is no query — unless asked for (Ctrl + Space):
 * then the most used texts, as they come.
 * Every match is returned; the list shows them a page at a time.
 */

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

/** How well a text holds the query, best first: its start, a word's start, anywhere. */
const START = 0;
const WORD_START = 1;
const INSIDE = 2;

function matchAt(folded: string, query: string): { at: number; rank: number } | null {
  if (folded.startsWith(query)) return { at: 0, rank: START };
  const word = folded.indexOf(` ${query}`);
  if (word >= 0) return { at: word + 1, rank: WORD_START };
  const inside = folded.indexOf(query);
  return inside >= 0 ? { at: inside, rank: INSIDE } : null;
}

export function matchSuggestions(
  typed: string,
  values: readonly string[],
  { whenEmpty = false }: { whenEmpty?: boolean } = {},
): Suggestion[] {
  const query = fold(typed.trim());
  if (query.length === 0) {
    return whenEmpty ? values.map((text) => ({ text, start: 0, length: 0 })) : [];
  }

  const ranked: Suggestion[][] = [[], [], []];
  for (const text of values) {
    const folded = fold(text);
    if (folded.trim() === query) continue;
    const match = matchAt(folded, query);
    if (match) ranked[match.rank].push({ text, start: match.at, length: query.length });
  }
  return ranked.flat();
}
