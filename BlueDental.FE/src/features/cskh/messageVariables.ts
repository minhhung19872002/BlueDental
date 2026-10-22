import { t } from "@/lib/i18n";
import { foldForSearch } from "@/utils/foldForSearch";
import { VARIABLE_GROUP, WHEN_EMPTY, type MessageVariable, type VariableGroup } from "./api/templateApi";

/** Library order of the group pills and headings. */
export const VARIABLE_GROUPS: readonly VariableGroup[] = [
  VARIABLE_GROUP.Customer,
  VARIABLE_GROUP.Appointment,
  VARIABLE_GROUP.Treatment,
  VARIABLE_GROUP.System,
];

export const variableGroupLabels = (): Record<VariableGroup, string> => ({
  [VARIABLE_GROUP.Customer]: t("CSKH:VarGroup:Customer"),
  [VARIABLE_GROUP.Appointment]: t("CSKH:VarGroup:Appointment"),
  [VARIABLE_GROUP.Treatment]: t("CSKH:VarGroup:Treatment"),
  [VARIABLE_GROUP.System]: t("CSKH:VarGroup:System"),
});

export function variableLabel(key: string): string {
  return t(`CSKH:Var:${key}`);
}

/** A send's gap: a variable by its label, else a ZNS parameter Zalo requires, by its own name. */
export function missingLabel(key: string): string {
  const variableKey = `CSKH:Var:${key}`;
  const label = t(variableKey);
  return label === variableKey ? t("CSKH:Send:ZnsParam", key) : label;
}

export function quoteVariable(key: string): string {
  return `{${key}}`;
}

/** "trống: Quý khách" · "trống: bỏ qua khách" · "trống: luôn có". */
export function whenEmptyLabel(variable: MessageVariable): string {
  if (variable.whenEmpty === WHEN_EMPTY.SkipCustomer) return t("CSKH:Template:WhenEmpty:Skip");
  if (variable.whenEmpty === WHEN_EMPTY.AlwaysPresent) return t("CSKH:Template:WhenEmpty:Always");
  return t("CSKH:Template:WhenEmpty:Fallback", variable.fallback ?? "");
}

/** Folded words, space-led, so a query can be matched at a word start. */
const asWords = (text: string) => foldForSearch(text).replace(/[^a-z0-9]+/g, " ").trim();

/**
 * "ngay_h", "ngày h", "ngay hen" and "hen" all find {ngay_hen} · Ngày hẹn.
 * The query must start a word, so "ng" brings up the Ngày … variables only,
 * not {ten_khach_hang} (BA img_08).
 */
export function matchesVariable(variable: MessageVariable, query: string): boolean {
  const wanted = asWords(query);
  if (!wanted) return true;
  return [variable.key, variableLabel(variable.key)].some((text) => ` ${asWords(text)}`.includes(` ${wanted}`));
}

/** Same token as the server's MessageTemplateRenderer. */
const VARIABLE_TOKEN = /\{([a-z0-9_]+)\}/g;

/** Every variable quoted in the texts, first-seen order, each once. */
export function findVariables(...texts: string[]): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(VARIABLE_TOKEN)) keys.add(match[1]);
  }
  return [...keys];
}

/** The text with every `{key}` taken out, and the gap it leaves closed. */
export function removeVariable(text: string, key: string): string {
  return text.split(quoteVariable(key)).join("").replace(/ {2,}/g, " ");
}
