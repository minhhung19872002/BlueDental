/**
 * Money as the Vận hành reports write it: dot-separated with the symbol.
 *
 * The shared `formatVND` drops the symbol on purpose — the screens that use it
 * put "đ" in the column heading instead. These reports follow the reference,
 * which carries it on every figure, cards and cells alike.
 */
export function formatMoney(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}
