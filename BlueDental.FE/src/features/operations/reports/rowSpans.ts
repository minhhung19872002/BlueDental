/**
 * How many rows each cell of a grouped column has to span.
 *
 * A table groups by writing the whole group's height onto its first row and
 * zero onto the rest — zero is how a table drops a cell entirely. Groups are
 * runs of adjacent rows, never a gather across the page: the server pages by
 * row, so a group can be cut in half by a page boundary and the spans have to
 * describe what is actually on screen.
 *
 * Keys nest. A later key only starts a new group where it changes *and* every
 * key before it has held, so a patient block never straddles two dates.
 */
export function rowSpansBy<T>(rows: T[], keys: ((row: T) => string)[]): number[][] {
  const spans = keys.map(() => new Array<number>(rows.length).fill(0));
  const starts = keys.map(() => 0);

  rows.forEach((row, index) => {
    let broken = false;

    keys.forEach((keyOf, level) => {
      const isNew =
        index === 0 || broken || keyOf(row) !== keyOf(rows[index - 1]);

      if (isNew) {
        starts[level] = index;
        broken = true;
      }

      spans[level][starts[level]] += 1;
    });
  });

  return spans;
}
