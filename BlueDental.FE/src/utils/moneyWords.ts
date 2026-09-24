import { getLocale, t } from "@/lib/i18n";

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const SCALES = ["", "nghìn", "triệu"];

const EN_ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_SCALES = ["", "thousand", "million", "billion", "trillion", "quadrillion"];

/** One group of three digits; `full` reads a leading "không trăm" when a higher group precedes it. */
function readGroup(group: number, full: boolean): string {
  const hundreds = Math.floor(group / 100);
  const tens = Math.floor(group / 10) % 10;
  const units = group % 10;
  const words: string[] = [];

  if (hundreds > 0 || full) words.push(DIGITS[hundreds], "trăm");

  if (tens === 0) {
    if (units > 0) {
      if (hundreds > 0 || full) words.push("lẻ");
      words.push(DIGITS[units]);
    }
    return words.join(" ");
  }

  if (tens === 1) words.push("mười");
  else words.push(DIGITS[tens], "mươi");

  if (units === 1 && tens > 1) words.push("mốt");
  else if (units === 5) words.push("lăm");
  else if (units > 0) words.push(DIGITS[units]);

  return words.join(" ");
}

/** "nghìn", "triệu", "tỷ", "nghìn tỷ" … for the group at `index` counted from the units. */
function scaleOf(index: number): string {
  const billions = Math.floor(index / 3);
  return [SCALES[index % 3], ...Array<string>(billions).fill("tỷ")].filter(Boolean).join(" ");
}

/** One group of three digits in English: 345 → "three hundred forty-five". */
function readGroupEn(group: number): string {
  const hundreds = Math.floor(group / 100);
  const rest = group % 100;
  const words: string[] = [];

  if (hundreds > 0) words.push(EN_ONES[hundreds], "hundred");
  if (rest > 0 && rest < 20) words.push(EN_ONES[rest]);
  else if (rest >= 20) {
    const units = rest % 10;
    words.push(units ? `${EN_TENS[Math.floor(rest / 10)]}-${EN_ONES[units]}` : EN_TENS[rest / 10]);
  }

  return words.join(" ");
}

function groupsOf(value: number): number[] {
  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  return groups;
}

function vietnameseWords(groups: number[]): string {
  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group === 0) continue;
    words.push(readGroup(group, index < groups.length - 1));
    const scale = scaleOf(index);
    if (scale) words.push(scale);
  }
  return words.join(" ");
}

function englishWords(groups: number[]): string {
  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group === 0) continue;
    words.push(readGroupEn(group));
    if (EN_SCALES[index]) words.push(EN_SCALES[index]);
  }
  return words.join(" ");
}

/**
 * A sum in words, the way a receipt spells "Số tiền bằng chữ", in the screen's
 * language: 300000 → "Ba trăm nghìn đồng" / "Three hundred thousand dong".
 * Decimals are dropped, the sign ignored.
 */
export function moneyInWords(amount: number): string {
  const value = Math.floor(Math.abs(amount));
  if (!Number.isFinite(value) || value === 0) return t("Common:Currency:ZeroWords");

  const groups = groupsOf(value);
  const spelled = getLocale() === "en" ? englishWords(groups) : vietnameseWords(groups);
  const text = `${spelled} ${t("Common:Currency:Dong")}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
