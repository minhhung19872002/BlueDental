import { t } from "@/lib/i18n";

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const SCALES = ["", "nghìn", "triệu"];

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

/**
 * A sum in Vietnamese words, the way a receipt spells "Số tiền bằng chữ":
 * 300000 → "Ba trăm nghìn đồng". Decimals are dropped, the sign ignored.
 */
export function moneyInWords(amount: number): string {
  const value = Math.floor(Math.abs(amount));
  if (!Number.isFinite(value) || value === 0) return t("Không đồng");

  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);

  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group === 0) continue;
    words.push(readGroup(group, index < groups.length - 1));
    const scale = scaleOf(index);
    if (scale) words.push(scale);
  }

  const text = `${words.join(" ")} ${t("đồng")}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
