/** One "Danh sách công đoạn" line: an id and the text it stands for. */
export interface StageChecklistItem {
  id: string;
  name: string;
}

/**
 * Keeps "Nội dung điều trị" in step with the boxes ticked under
 * "Danh sách công đoạn".
 *
 * Read off the reference's published bundle 2026-09-22 — it calls this
 * `syncTreatmentContentWithStages` and runs it on every tick, in the stage form
 * and in "Tạo tái khám" alike (both are the same block):
 *
 * ```js
 * function L(content, checklist) {
 *   const a = checklist.filter(e => e.checked).map(e => e.label.trim()).filter(Boolean);
 *   const r = new Set(checklist.map(e => e.label.trim()).filter(Boolean));
 *   return [...a, ...content.split("\n").map(e => e.trim()).filter(e => e && !r.has(e))].join("\n");
 * }
 * ```
 *
 * Three things fall out of that, and all three matter:
 *
 * - The ticked names go **first**, in checklist order, above whatever was typed.
 * - Any line equal to **any** checklist name is dropped from the typed text
 *   before the ticked ones are put back, so unticking removes that line and
 *   ticking twice never doubles it.
 * - Every line is trimmed and blank lines are dropped, so the field cannot
 *   collect empty rows as boxes go on and off.
 */
export function syncStageContent(
  content: string,
  checklist: StageChecklistItem[],
  tickedIds: string[],
): string {
  const named = checklist.map((item) => item.name.trim()).filter(Boolean);
  const known = new Set(named);
  const ticked = checklist
    .filter((item) => tickedIds.includes(item.id))
    .map((item) => item.name.trim())
    .filter(Boolean);

  const typed = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !known.has(line));

  return [...ticked, ...typed].join("\n");
}
