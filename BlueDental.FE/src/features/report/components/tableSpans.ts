/**
 * Row-span map for a column whose consecutive equal keys merge into one cell
 * (the reference groups service/payment rows by date, then by patient).
 */
export function groupSpans<T>(rows: T[], keyOf: (row: T) => string): number[] {
  const spans = new Array<number>(rows.length).fill(0);
  let start = 0;
  for (let i = 1; i <= rows.length; i++) {
    if (i === rows.length || keyOf(rows[i]) !== keyOf(rows[start])) {
      spans[start] = i - start;
      start = i;
    }
  }
  return spans;
}

export function spanCell(spans: number[]) {
  return (_row: unknown, index?: number) => ({ rowSpan: spans[index ?? 0] ?? 1 });
}
