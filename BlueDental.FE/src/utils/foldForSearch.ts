/**
 * Case- and accent-blind form of a string, for matching what a user types.
 *
 * Vietnamese keyboards do not agree on how to encode a toned letter: some send
 * "ú" as one code point, others as "u" plus a combining acute. Comparing the
 * raw strings misses one of the two, so a user typing "phú nhuậ" never finds
 * "Phường Phú Nhuận". Dropping the marks also lets "phu nhuan" find it.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
