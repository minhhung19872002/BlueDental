/*
 * The markup of a blank and a tick box, as every form draws them, for the
 * forms written here rather than copied from the reference's editor (mẫu 11
 * and 12). The output is the same tags the copied templates carry, so the
 * sheet fills, edits and prints them alike.
 */

interface BlankOptions {
  /** The record fact the blank is filled from (`patient.age`, …). */
  source?: string;
  /** The blank runs to the end of its line, or fills its cell. */
  full?: boolean;
}

const SOURCE = (source?: string) => (source ? ` data-field-source="${source}"` : "");

/** A text blank, at least `width` px wide. */
export function blank(id: string, width: number, { source, full = false }: BlankOptions = {}): string {
  const style = full
    ? `min-width: ${width}px; display: inline-block; width: 100%; max-width: none; box-sizing: border-box;`
    : `min-width: ${width}px;`;
  return (
    `<span><span data-medical-record-field="${id}"${SOURCE(source)} data-placeholder="" ` +
    `data-field-width="${width}" data-field-full-width="${full}" class="nfc-medical-record-text-field" ` +
    `data-field-type="text" contenteditable="true" style="${style}"></span></span>`
  );
}

/** A tick box; `label` is what it is read out as. */
export function box(id: string, label: string, source?: string): string {
  return `<input data-medical-record-field="${id}"${SOURCE(source)} aria-label="${label}" class="nfc-medical-record-checkbox" type="checkbox">`;
}

/** A tick box followed by its printed label. */
export function ticked(id: string, label: string, source?: string): string {
  return `${box(id, label, source)} ${label}`;
}

/** The letterhead every form of the clinic opens with. */
export const LETTERHEAD =
  '<p data-block-align="left" style="text-align: center; line-height: 1.25; display: table; max-width: 100%; margin-left: 0px; margin-right: auto;"><span style="font-size: 10pt;"><strong>' +
  "SỞ Y TẾ THÀNH PHỐ HỒ CHÍ MINH<br>PHÒNG KHÁM CHUYÊN KHOA RĂNG HÀM MẶT<br>THUỘC CÔNG TY CỔ PHẦN DỊCH VỤ<br>NHA KHOA ĐỨC HẠNH" +
  "</strong></span></p>";

/** "MS:", "Mã người bệnh:" … in the right-hand corner, labels and blanks in two columns. */
export function recordIds(rows: readonly (readonly [label: string, blank: string])[]): string {
  const cells = rows
    .map(([label, field]) => `<span class="record-ids-label"><strong>${label}</strong></span><span>${field}</span>`)
    .join("");
  return `<p class="record-ids">${cells}</p>`;
}

/** The letterhead on the left, the record ids against the right margin. */
export function header(ids: readonly (readonly [label: string, blank: string])[]): string {
  return (
    '<table data-borderless="true" style="min-width: 368px;"><colgroup><col style="width: 343px;"><col style="min-width: 25px;"></colgroup><tbody><tr>' +
    `<td colspan="1" rowspan="1" colwidth="343">${LETTERHEAD}</td><td colspan="1" rowspan="1">${recordIds(ids)}</td>` +
    "</tr></tbody></table>"
  );
}

/** A signature column: who signs, "(Ký, ghi rõ họ tên)", room to sign, and the name. */
export function signature(title: string, nameId: string): string {
  return (
    `<td colspan="1" rowspan="1"><p style="text-align: center;"><strong>${title}</strong><br><em>(Ký, ghi rõ họ tên)</em>` +
    `<br><br><br>${blank(nameId, 160)}</p></td>`
  );
}
