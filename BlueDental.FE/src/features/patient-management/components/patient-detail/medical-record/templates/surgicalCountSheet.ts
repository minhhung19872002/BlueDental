import { blank, box, header, signature, ticked } from "./sheetMarkup";

/*
 * Bảng kiểm đếm gạc, dụng cụ sắc nhọn, dụng cụ (MS PT-06) — the clinic's own
 * paper form (2026-11-16), one A4 page upright inside 15mm margins, at the
 * sizes the BA set in Word (R-1276, sheetCss). The reference has no such form.
 *
 * The count table is a grid: its cells print without the dotted line, except
 * the gauze sizes ("Gạc …x…cm"), which the paper dots.
 */

const ID = "surgical-count";
const text = (n: number) => `${ID}.text.${n}`;
const check = (n: number) => `${ID}.check.${n}`;

/** "Trước khi rạch da", five "Số lượng cung cấp thêm", "Đếm khi đóng khoang rỗng", "Khi đóng da". */
const COUNT_CELLS = 8;

/** A blank filling a cell of the count table. */
const cell = (id: string) => `<td colspan="1" rowspan="1"><p>${blank(id, 30, { full: true })}</p></td>`;

const counts = (row: number) =>
  Array.from({ length: COUNT_CELLS }, (_, at) => cell(`${ID}.count.${row}.${at + 1}`)).join("");

const gauze = (row: number) =>
  `${box(check(row), "Gạc")} Gạc ${blank(`${ID}.gauze.${row}.width`, 28)}x${blank(`${ID}.gauze.${row}.length`, 28)}cm`;

/** What each row counts, as the paper prints it; the last row is left for the nurse to name. */
const ITEMS: readonly string[] = [
  gauze(1),
  gauze(2),
  ticked(check(3), "Kim"),
  ticked(check(4), "Dao"),
  ticked(check(5), "Dụng cụ"),
  blank(text(1), 60, { full: true }),
];

const headCell = (title: string, span = 1) =>
  `<td colspan="${span}" rowspan="1"><p style="text-align: center;"><strong>${title}</strong></p></td>`;

const COUNT_TABLE =
  '<table data-record-section="surgical-count" style="width: 680px;"><colgroup><col style="width: 190px;"><col style="width: 70px;">' +
  '<col style="width: 52px;"><col style="width: 52px;"><col style="width: 52px;"><col style="width: 52px;"><col style="width: 52px;">' +
  '<col style="width: 85px;"><col style="width: 75px;"></colgroup><tbody>' +
  `<tr>${headCell("Dụng cụ vật tư cần kiểm đếm")}${headCell("Trước khi rạch da")}${headCell("Số lượng cung cấp thêm", 5)}` +
  `${headCell("Đếm khi đóng khoang rỗng")}${headCell("Khi đóng da")}</tr>` +
  ITEMS.map((item, at) => `<tr><td colspan="1" rowspan="1"><p>${item}</p></td>${counts(at + 1)}</tr>`).join("") +
  "</tbody></table>";

const line = (id: string) => `<p>${blank(id, 320, { full: true })}</p>`;

export const SURGICAL_COUNT_SHEET_TEMPLATE =
  header([
    ["MS:", blank(`${ID}.form-code`, 120)],
    ["Số vào viện:", blank(`${ID}.admission-number`, 120)],
    ["Mã người bệnh:", blank(`${ID}.patient.code`, 120, { source: "patient.code" })],
  ]) +
  '<h1 data-record-section="surgical-count-title" style="text-align: center;"><span style="font-size: 15pt;"><strong>' +
  "BẢNG KIỂM ĐẾM GẠC, DỤNG CỤ SẮC NHỌN, DỤNG CỤ</strong></span></h1>" +
  `<p>Họ và tên người bệnh: ${blank(`${ID}.patient.name`, 300, { source: "patient.nameUppercase" })}` +
  ` &nbsp;&nbsp; Tuổi: ${blank(`${ID}.patient.age`, 56, { source: "patient.age" })}` +
  ` &nbsp;&nbsp; ${ticked(`${ID}.patient.gender-male`, "Nam", "patient.genderMale")}` +
  ` &nbsp;&nbsp; ${ticked(`${ID}.patient.gender-female`, "Nữ", "patient.genderFemale")}</p>` +
  COUNT_TABLE +
  `<p><strong>Kết thúc cuộc phẫu thuật:</strong> &nbsp; ${ticked(check(11), "Kiểm đủ")} &nbsp;&nbsp; ${ticked(check(12), "Không đủ")}</p>` +
  `<p>Mô tả vật dụng mất: ${blank(text(2), 500)}</p>` +
  `<p><strong>Thông báo cho phẫu thuật viên:</strong> &nbsp; ${ticked(check(13), "Không")} &nbsp;&nbsp; ${ticked(check(14), "Có")}</p>` +
  `<p><strong>Kiểm tra XQ:</strong> &nbsp; ${ticked(check(15), "Không")} &nbsp;&nbsp; ${ticked(check(16), "Có")}</p>` +
  `<p><strong>Kết quả:</strong> &nbsp; ${ticked(check(17), "Tìm được vật dụng")}</p>` +
  `<p>${ticked(check(18), "Không tìm được (ghi rõ):")} ${blank(text(3), 440)}</p>` +
  line(text(4)) +
  `<p><strong>Xử lý:</strong> ${blank(text(5), 600)}</p>` +
  line(text(6)) +
  '<table data-borderless="true" data-record-section="signature" style="min-width: 50px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr>' +
  signature("ĐIỀU DƯỠNG VÒNG TRONG", text(7)) +
  signature("ĐIỀU DƯỠNG VÒNG NGOÀI", text(8)) +
  "</tr></tbody></table>";
