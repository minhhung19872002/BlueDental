import { matchesSearch } from "@/utils/foldForSearch";

/** One choice of the Dịch vụ / Vật liệu rows and their «Xem thêm» popup (P3110 m134, m158). */
export interface LaboChoiceItem {
  value: string;
  label: string;
  /** The popup's section and group chip; none and the list has no headers. */
  group?: string;
  /** The grey line under the name. */
  description?: string;
  /** Right of the row — "7 vật liệu". */
  extra?: string;
  /** Other words the search matches: a service's materials. */
  keywords?: string[];
}

/** How many chips a row shows before «Xem thêm» (REQ-C4). */
export const LABO_ROW_CHIPS = 3;

/**
 * The row's chips: the first three, with the choice always among them — a
 * choice further down the list takes the last place (REQ-C4).
 */
export function shownChoices(items: LaboChoiceItem[], value: string | undefined): LaboChoiceItem[] {
  const first = items.slice(0, LABO_ROW_CHIPS);
  const chosen = items.find((item) => item.value === value);
  if (!chosen || first.includes(chosen)) return first;
  return [...first.slice(0, LABO_ROW_CHIPS - 1), chosen];
}

/** The search matches the name, the line under it and the keywords, blind to case and marks. */
export function matchesChoice(item: LaboChoiceItem, query: string): boolean {
  return [item.label, item.description, ...(item.keywords ?? [])].some((text) => matchesSearch(text, query));
}

export interface LaboChoiceGroup {
  name: string;
  count: number;
}

/** The group chips after «Tất cả», in the list's order. */
export function choiceGroups(items: LaboChoiceItem[]): LaboChoiceGroup[] {
  const groups = new Map<string, number>();
  for (const item of items) if (item.group) groups.set(item.group, (groups.get(item.group) ?? 0) + 1);
  return [...groups].map(([name, count]) => ({ name, count }));
}

export interface LaboChoiceSection {
  /** "PHỤC HÌNH CỐ ĐỊNH"; empty for the choices of no group. */
  name: string;
  items: LaboChoiceItem[];
}

/** The list cut into its sections, each in the order its first choice comes. */
export function choiceSections(items: LaboChoiceItem[]): LaboChoiceSection[] {
  const sections = new Map<string, LaboChoiceItem[]>();
  for (const item of items) {
    const name = item.group ?? "";
    sections.set(name, [...(sections.get(name) ?? []), item]);
  }
  return [...sections].map(([name, rows]) => ({ name, items: rows }));
}
