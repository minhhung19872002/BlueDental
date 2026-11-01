import type { FieldValues } from "./fieldValues";

/**
 * Hợp đồng thỏa thuận niềng răng (mẫu 10) filled from Bệnh án chỉnh nha (mẫu 3)
 * of the same set (BA, 2026-11-01, R-1097). One way only: what is typed on the
 * contract wins, as over any answer, and nothing goes back to mẫu 3.
 *
 * Taken across: VIII Chẩn đoán, Nhổ răng, the plan lines of IX, Thời gian điều
 * trị dự kiến and Loại mắc cài. Cắm minivis, Vị trí mắc cài răng cửa HT, Khâu
 * răng and Bác sĩ stay on mẫu 3; Khí cụ and II. Chi phí are the contract's own.
 */

const ids = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, at) => `${prefix}${from + at}`);

/** Mẫu 3, VIII. Chẩn đoán: nine lines. */
const ORTHODONTIC_DIAGNOSIS = ids("orthodontic.text.", 86, 94);
/** Mẫu 3, IX: the free line under Loại mắc cài, then the seven the slips fill. */
const ORTHODONTIC_PLAN = ids("orthodontic.text.", 104, 111);
const ORTHODONTIC_TIME = "orthodontic.text.99";

/** Mẫu 10, "1. Chẩn đoán:" and the two lines under it. */
const CONTRACT_DIAGNOSIS = ids("orthodontic-contract.text.", 7, 9);
/** Mẫu 10, "- Kế hoạch điều trị:" and the four lines under it. */
const CONTRACT_PLAN = ids("orthodontic-contract.text.", 11, 15);
const CONTRACT_TIME = "orthodontic-contract.text.19";

/** One blank for one: Nhổ răng, then Loại mắc cài's four boxes and four prices. */
const SAME_BLANK: readonly (readonly [string, string])[] = [
  ["orthodontic.text.95", "orthodontic-contract.text.10"],
  ...[61, 62, 63, 64].map((box, at) => [`orthodontic.checkbox.${box}`, `orthodontic-contract.checkbox.${at + 1}`] as const),
  ...[100, 101, 102, 103].map((price, at) => [`orthodontic.text.${price}`, `orthodontic-contract.text.${34 + at}`] as const),
];

const ADDED_LINE = /^custom\.line\.(.+)\.(\d+)$/;

const textOf = (value: FieldValues[string] | undefined) => (typeof value === "string" ? value.trim() : "");

/** The blanks' text, each followed by the lines added under it, empty ones dropped. */
function linesOf(values: FieldValues, blanks: readonly string[]): string[] {
  const added = new Map<string, { at: number; text: string }[]>();
  for (const [key, value] of Object.entries(values)) {
    const match = key.match(ADDED_LINE);
    if (!match || !blanks.includes(match[1])) continue;
    added.set(match[1], [...(added.get(match[1]) ?? []), { at: Number(match[2]), text: textOf(value) }]);
  }
  return blanks
    .flatMap((blank) => [
      textOf(values[blank]),
      ...(added.get(blank) ?? []).sort((a, b) => a.at - b.at).map((line) => line.text),
    ])
    .filter(Boolean);
}

/** The printed blanks first; past the last, lines added under it. */
function putLines(values: FieldValues, printed: readonly string[], lines: readonly string[]) {
  lines.forEach((line, at) => {
    const blank = printed[at];
    values[blank ?? `custom.line.${printed.at(-1)}.${at - printed.length + 1}`] = line;
  });
}

/** Whether a contract blank is one mẫu 3 answers — what the contract's own answer gives way on. */
function takenOver(key: string): boolean {
  const match = key.match(ADDED_LINE);
  const blank = match ? match[1] : key;
  return (
    CONTRACT_DIAGNOSIS.includes(blank) ||
    CONTRACT_PLAN.includes(blank) ||
    blank === CONTRACT_TIME ||
    SAME_BLANK.some(([, contract]) => contract === blank)
  );
}

/**
 * What the contract's blanks fall back to once the set has a mẫu 3: its own
 * answers, with the blanks above taken from `orthodontic` — mẫu 3 as it reads,
 * what was written on it over what it answers.
 */
export function contractAutoFrom(contract: FieldValues, orthodontic: FieldValues): FieldValues {
  const values = Object.fromEntries(Object.entries(contract).filter(([key]) => !takenOver(key)));

  putLines(values, CONTRACT_DIAGNOSIS, linesOf(orthodontic, ORTHODONTIC_DIAGNOSIS));
  putLines(values, CONTRACT_PLAN, linesOf(orthodontic, ORTHODONTIC_PLAN));

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
