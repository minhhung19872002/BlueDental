/** Up to this many pills the reference keeps a single row. */
const SINGLE_ROW_MAX = 12;
/** A label longer than this weighs no more — a truncated pill is no wider. */
const LABEL_CAP = 28;
/** A pill's padding and border, in the same "characters" as its label. */
const PILL_PADDING = 4;

/**
 * The reference's two-row split for its chip strips (`row: 2`): a dozen
 * pills or fewer stay on one row; more are cut into two runs, first half
 * above, second below, at the point that best balances the rows' widths —
 * each pill weighed by its label length (capped at 28) plus 4 for padding.
 */
export function splitChipRows<T>(items: T[], labelOf: (item: T) => string): T[][] {
  if (items.length <= SINGLE_ROW_MAX) return [items];

  const weights = items.map((item) => Math.min(labelOf(item).length, LABEL_CAP) + PILL_PADDING);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let prefix = 0;
  let cut = 1;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < items.length; index += 1) {
    prefix += weights[index - 1];
    const imbalance = Math.abs(total - 2 * prefix);
    // `<=`, as the reference writes it: of two equally balanced cuts the later wins.
    if (imbalance <= best) {
      best = imbalance;
      cut = index;
    }
  }

  return [items.slice(0, cut), items.slice(cut)];
}
