import type { FieldValues } from "./fieldValues";

/**
 * Hợp đồng thỏa thuận niềng răng (mẫu 10) filled from Bệnh án chỉnh nha (mẫu 3)
 * of the same set (BA, 2026-11-01, R-1097). One way only: what is typed on the
 * contract wins, as over any answer, and nothing goes back to mẫu 3.
 *
 * Taken across: Nhổ răng, Thời gian điều trị dự kiến and Loại mắc cài. Chẩn
 * đoán and Kế hoạch điều trị no longer are (BA, 2026-11-26, R-1324): mẫu 3's
 * VIII and IX hold the patient's other diagnoses and services too, and the
 * contract is for braces alone — they are written on it by hand, as Khí cụ
 * and II. Chi phí are. Cắm minivis, Vị trí mắc cài răng cửa HT, Khâu răng and
 * Bác sĩ stay on mẫu 3.
 */

const ORTHODONTIC_TIME = "orthodontic.text.99";
const CONTRACT_TIME = "orthodontic-contract.text.19";

/** One blank for one: Nhổ răng, then Loại mắc cài's four boxes and four prices. */
const SAME_BLANK: readonly (readonly [string, string])[] = [
  ["orthodontic.text.95", "orthodontic-contract.text.10"],
  ...[61, 62, 63, 64].map((box, at) => [`orthodontic.checkbox.${box}`, `orthodontic-contract.checkbox.${at + 1}`] as const),
  ...[100, 101, 102, 103].map((price, at) => [`orthodontic.text.${price}`, `orthodontic-contract.text.${34 + at}`] as const),
];

const textOf = (value: FieldValues[string] | undefined) => (typeof value === "string" ? value.trim() : "");

/** Whether a contract blank is one mẫu 3 answers — what the contract's own answer gives way on. */
function takenOver(key: string): boolean {
  return key === CONTRACT_TIME || SAME_BLANK.some(([, contract]) => contract === key);
}

/**
 * What the contract's blanks fall back to once the set has a mẫu 3: its own
 * answers, with the blanks above taken from `orthodontic` — mẫu 3 as it reads,
 * what was written on it over what it answers.
 */
export function contractAutoFrom(contract: FieldValues, orthodontic: FieldValues): FieldValues {
  const values = Object.fromEntries(Object.entries(contract).filter(([key]) => !takenOver(key)));

  // "Thời gian điều trị dự kiến: 24 tháng" — mẫu 3 prints the unit after its blank.
  const months = textOf(orthodontic[ORTHODONTIC_TIME]);
  if (months) values[CONTRACT_TIME] = /tháng$/i.test(months) ? months : `${months} tháng`;

  for (const [from, to] of SAME_BLANK) {
    const value = orthodontic[from];
    if (value === true) values[to] = true;
    else if (textOf(value)) values[to] = textOf(value);
  }
  return values;
}
