import { foldForSearch } from "@/utils/foldForSearch";

interface Labelled {
  label: string;
}

/**
 * The tier word an address unit's name opens with. Every "Phường ..." holds
 * "phu", so ranking on the whole label would put "Phường Thủ Dầu Một" ahead of
 * "Phường Phú Lợi" for a user typing "phu".
 */
const LEADING_TIER = /^(phuong|xa|thi tran|dac khu|thanh pho|tinh)\s+/;

const exactForm = (value: string) => value.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Lower ranks first: name opens with the keyword, a word opens with it, it sits mid-word. */
function rank(foldedLabel: string, keyword: string): number {
  const name = foldedLabel.replace(LEADING_TIER, "");
  if (name.startsWith(keyword)) return 0;
  if (name.includes(` ${keyword}`)) return 1;
  return 2;
}

/**
 * Options whose label holds the keyword, ignoring case, accents and how the
 * keyboard encoded them, best match first so Enter can take the top row:
 * labels that also match the accents as typed ("phụ" finds "Phụng" before
 * "Phú"), then where the keyword lands in the name. Ties keep the list's order.
 */
export function filterOptions<T extends Labelled>(options: T[], keyword: string): T[] {
  const folded = foldForSearch(keyword);
  if (!folded) return options;

  const exact = exactForm(keyword);
  return options
    .map((option, index) => ({ option, index, label: foldForSearch(option.label) }))
    .filter((row) => row.label.includes(folded))
    .map((row) => ({
      ...row,
      score: (exactForm(row.option.label).includes(exact) ? 0 : 3) + rank(row.label, folded),
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((row) => row.option);
}
