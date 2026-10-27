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

/** Whether `text` holds what was typed, ignoring case, accents and how they were encoded. */
export function matchesSearch(text: string | null | undefined, query: string): boolean {
  const wanted = foldForSearch(query);
  return !wanted || foldForSearch(text ?? "").includes(wanted);
}

interface SearchableOption {
  label?: unknown;
  title?: unknown;
}

/** The text an option is searched by: its label, or its title where the label is markup. */
function optionText(option: SearchableOption | undefined): string {
  if (typeof option?.label === "string") return option.label;
  return typeof option?.title === "string" ? option.title : "";
}

/**
 * `filterOption` for an AntD Select. The built-in one only ignores case, so
 * "van dinh" never found "Văn Định"; this one matches the way every search box
 * does (R-1051).
 */
export function foldFilterOption(input: string, option?: SearchableOption): boolean {
  return matchesSearch(optionText(option), input);
}
