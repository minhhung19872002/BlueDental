import { blank, box, ticked } from "./sheetMarkup";

/*
 * Bảng kiểm an toàn phẫu thuật (MS PT-04) — the clinic's own paper form
 * (2026-11-16), the one sheet printed on A4 landscape, 10mm margins. The
 * reference has no such form.
 *
 * Laid out as the paper is (clinic 2026-11-16, "chưa giống lắm"): the clinic's
 * name in small mixed case on the left (its Sở Y tế line bold), the title
 * beside it, only "MS: PT-04" in the corner (the patient's code is on the name
 * line). The three stages' titles stand in boxes of their own (the BA's Word
 * copy, R-1283, draws no arrows between them); under them one ruled table of
 * three columns (four rows, see below), each opening with who checks it in italics. The
 * answers sit on a line of their own under each question, the second answer at
 * a set place (`ss-opt`). One italic signature line under each column.
 *
 * The words and where each line breaks are the paper's (`BR`, clinic
 * 2026-11-16: "nội dung, xuống dòng, chưa thực sự khớp 100%") — where the
 * BA's Word copy (R-1283) lets a line wrap on its own, so does the sheet; the first column
 * is a little wider so its longest line ("… người bệnh và") holds.
 *
 * The tick boxes and blanks are numbered in the order of the first layout, so
 * sheets saved before keep their ticks; the sixth note line, added later, is
 * text.9.
 */

const ID = "surgical-safety";
const text = (n: number) => `${ID}.text.${n}`;

/** Where the paper breaks a line. */
const BR = "<br>";

/**
 * A numbered tick box of this form and its printed label; `printed` when the
 * label breaks where the paper does (the box is read out as `label`).
 */
let boxes = 0;
const tick = (label: string, printed?: string) => {
  boxes += 1;
  const id = `${ID}.check.${boxes}`;
  return printed ? `${box(id, label)} ${printed}` : ticked(id, label);
};

const GAP = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
const p = (body: string) => `<p>${body}</p>`;
/** The first line of a section, ruled off from the one above. */
const section = (body: string) => `<p class="ss-rule">${body}</p>`;
const bold = (body: string) => `<strong>${body}</strong>`;
const who = (body: string) => `<p class="ss-who"><em>(${body})</em></p>`;
/** Two answers on one line, the second at the same place on every line of the column. */
const both = (left: string, right: string) => p(`<span class="ss-opt">${tick(left)}</span>${tick(right)}`);

/*
 * The stages are one table of four rows, as the paper is: a rule across a
 * column is a row's edge, so where the paper's rules line up from one column
 * to the next they are the same edge (clinic 2026-11-16: "2 đường kẻ ngang
 * này không ngang hàng") — above Vùng mổ and above Dự kiến (row 2), above
 * Thuốc and above Đối với PTV (row 3). The second column spans rows 2–4 and
 * the third rows 1–2 and 3–4; the second column's own rules (above Kháng sinh
 * and above Chẩn đoán hình ảnh) line up with nothing, so they stay `ss-rule`.
 *
 * Built in the order of the first layout (first column, second, third), so
 * the tick boxes keep their numbers.
 */

/** First column, row 1: who checks, and the patient's papers. */
const A1 =
  who("Bác sĩ gây mê, KTV/điều dưỡng gây mê") +
  p(bold("Người bệnh đã được kiểm tra, xác nhận:")) +
  p(tick("Họ và tên, tuổi, giới tính, mã người bệnh")) +
  p(tick("Vị trí phẫu thuật")) +
  p(tick("Phương pháp phẫu thuật dự kiến")) +
  p(tick("Giấy cam kết chấp nhận phẫu thuật, thủ thuật, GMHS"));
/** Row 2: Vùng mổ. */
const A2 = p(bold("Vùng mổ được đánh dấu:")) + both("Có", "Không áp dụng");
/** Row 3: Thuốc and Máy đo, one cell — the paper rules nothing between them (clinic 2026-11-16). */
const A3 =
  p(bold("Thuốc và thiết bị gây mê đầy đủ và sẵn sàng:")) +
  p(tick("Có")) +
  p(bold("Máy đo bão hòa oxy trong máu gắn trên người bệnh và hoạt động bình thường:")) +
  p(tick("Có"));
/** Row 4: the patient's risks. */
const A4 =
  p(bold("Người bệnh có tiền sử dị ứng/say tàu xe:")) +
  both("Có", "Không") +
  p(bold("Người bệnh có khó thở hoặc có nguy cơ sặc:")) +
  both("Không", "Có (thiết bị/dụng cụ hỗ trợ)") +
  p(bold(`Người bệnh có nguy cơ mất &gt; 500ml máu (7ml/kg ở${BR}trẻ em):`)) +
  p(tick("Không")) +
  p(
    tick(
      "Có, và có sẵn 2 đường truyền/tĩnh mạch trung tâm và dịch truyền/máu.",
      `Có, và có sẵn 2 đường truyền/tĩnh mạch trung tâm${BR}và dịch truyền/máu.`,
    ),
  );

/** Second column, row 1: who checks, the team, Kháng sinh. */
const B1 =
  who("Điều dưỡng phòng mổ, Bác sĩ gây mê, PTV") +
  p(bold(tick("Các thành viên trong kíp giới thiệu tên, nhiệm vụ"))) +
  p(bold(tick("Xác nhận lại họ tên người bệnh và vị trí rạch da bằng lời"))) +
  section(bold("Kháng sinh dự phòng:")) +
  both("Có", "Không áp dụng");
/** Rows 2–4: Dự kiến down to Chẩn đoán hình ảnh. */
const B2 =
  p(bold("Dự kiến:")) +
  p(bold("Đối với phẫu thuật viên (PTV):")) +
  p(tick("Những chú ý trong phẫu thuật hoặc diễn biến bất ngờ")) +
  p(tick("Thời gian phẫu thuật")) +
  p(tick("Dụng cụ đặc biệt dùng cho phẫu thuật")) +
  p(tick("Tiên lượng mất máu")) +
  p(bold("Đối với Bác sỹ gây mê:")) +
  p(tick("Điều cần chú ý trong gây mê ở người bệnh")) +
  p(bold("Đối với nhóm Điều dưỡng:")) +
  p(tick("Xác nhận tình trạng vô khuẩn bằng lời với các loại dụng cụ dùng cho phẫu thuật")) +
  p(`Thiết bị bị hỏng, bị thiếu:&nbsp;&nbsp;${tick("Có")}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${tick("Không")}`) +
  section(bold("Chẩn đoán hình ảnh thiết yếu được chiếu:")) +
  both("Có", "Không áp dụng");

/** A dotted line to write on, printed dotted though it sits in a ruled table. */
const notesLine = (n: number) => `<p class="ss-note">${blank(text(n), 200, { full: true })}</p>`;

/** Third column, rows 1–2: one run down to Dán nhãn's answers (clinic 2026-11-16: "liền mạch"). */
const C1 =
  who("Điều dưỡng phòng mổ, Bác sĩ gây mê, PTV") +
  p(bold("Điều dưỡng viên xác nhận lại bằng lời:")) +
  p(tick("Tên của phương pháp mổ")) +
  p(tick("Hoàn thành đếm gạc, kim và dụng cụ phẫu thuật")) +
  p(tick("Các vấn đề về dụng cụ cần giải quyết")) +
  p(`Dán nhãn bệnh phẩm (đọc to cả nhãn bệnh phẩm${BR}bao gồm cả tên người bệnh)`) +
  both("Có", "Không áp dụng");
/** Rows 3–4: the notes after the operation. */
const C2 =
  p(bold("Đối với PTV, BS gây mê, điều dưỡng:")) +
  p("Những vấn đề cần lưu ý đặc biệt về hồi tỉnh và chăm sóc sau mổ") +
  [1, 2, 3, 4, 5, 9].map(notesLine).join("");

const cell = (body: string) => `<td colspan="1" rowspan="1">${body}</td>`;
/** A cell of the stages' table: its column (`ss-col1…3`) and how many rows it spans. */
const stage = (column: number, body: string, rows = 1) =>
  `<td colspan="1" rowspan="${rows}" class="ss-col${column}">${body}</td>`;

/** The three columns' widths, the stages' and the signatures' alike. */
const COLUMNS = '<col style="width: 35%;"><col style="width: 33%;"><col style="width: 32%;">';

const stageHead = (title: string) => cell(`<p>${bold(title)}</p>`);
/** Between two boxes: room, and nothing in it — the BA's Word copy draws no arrow (R-1283). */
const GAP_CELL = cell("<p></p>");

/** The stages' titles, each in its own box. */
const STAGE_HEADS =
  '<table data-borderless="true" data-record-section="surgical-safety"><colgroup>' +
  // Boxes narrower than the columns under them, a gap between them, as Word's columns (27% / 9.5%).
  '<col style="width: 27%;"><col style="width: 9.5%;"><col style="width: 27%;"><col style="width: 9.5%;"><col style="width: 27%;">' +
  "</colgroup><tbody><tr>" +
  `${stageHead("TRƯỚC GÂY TÊ, GÂY MÊ")}${GAP_CELL}${stageHead("TRƯỚC KHI RẠCH DA")}${GAP_CELL}` +
  `${stageHead("TRƯỚC KHI RỜI KHỎI PHÒNG MỔ")}</tr></tbody></table>`;

/** The three stages under their titles, one ruled table. */
const STAGES =
  `<table data-record-section="surgical-safety-stages"><colgroup>${COLUMNS}</colgroup><tbody>` +
  `<tr>${stage(1, A1)}${stage(2, B1)}${stage(3, C1, 2)}</tr>` +
  `<tr>${stage(1, A2)}${stage(2, B2, 3)}</tr>` +
  `<tr>${stage(1, A3)}${stage(3, C2, 2)}</tr>` +
  `<tr>${stage(1, A4)}</tr>` +
  "</tbody></table>";

/** Who signs under each column, on one italic line, then room to sign and the name. */
const signature = (title: string, nameId: string) =>
  cell(`<p><em>${title} (Ký, ghi rõ họ tên)</em><br><br><br>${blank(nameId, 160)}</p>`);

const SIGNATURES =
  `<table data-borderless="true" data-record-section="signature"><colgroup>${COLUMNS}</colgroup><tbody><tr>` +
  signature("ĐD chạy ngoài/vòng ngoài", text(6)) +
  signature("ĐD dụng cụ/vòng trong", text(7)) +
  signature("Phẫu thuật viên", text(8)) +
  "</tr></tbody></table>";

/** The clinic's name as the paper prints it — small, mixed case, the Sở Y tế line bold — the title beside it, MS in the corner. */
const HEADER =
  '<table data-borderless="true" data-record-section="surgical-safety-header"><colgroup>' +
  '<col style="width: 30%;"><col style="width: 52%;"><col style="width: 18%;">' +
  "</colgroup><tbody><tr>" +
  cell(
    '<p class="ss-clinic"><strong>Sở Y tế Thành Phố Hồ Chí Minh</strong><br>Phòng khám Chuyên khoa Răng Hàm Mặt<br>' +
      "thuộc Công ty Cổ phần Dịch vụ Nha Khoa Đức Hạnh</p>",
  ) +
  cell('<h1 style="text-align: center;"><strong>BẢNG KIỂM AN TOÀN PHẪU THUẬT</strong></h1>') +
  cell(`<p class="ss-code">MS: ${blank(`${ID}.form-code`, 60)}</p>`) +
  "</tr></tbody></table>";

const PATIENT =
  `<p>Họ và tên: ${blank(`${ID}.patient.name`, 300, { source: "patient.nameUppercase" })}` +
  `${GAP}Tuổi: ${blank(`${ID}.patient.age`, 56, { source: "patient.age" })}` +
  `${GAP}Giới tính: ${ticked(`${ID}.patient.gender-male`, "Nam", "patient.genderMale")}` +
  ` &nbsp; ${ticked(`${ID}.patient.gender-female`, "Nữ", "patient.genderFemale")}` +
  `${GAP}Mã NB: ${blank(`${ID}.patient.code-line`, 140, { source: "patient.code" })}</p>` +
  `<p>Chẩn đoán: ${blank(`${ID}.diagnosis`, 560)}` +
  `${GAP}Ngày ${blank(`${ID}.date.day`, 32)} tháng ${blank(`${ID}.date.month`, 32)}` +
  ` năm 20${blank(`${ID}.date.year`, 32)}</p>`;

export const SURGICAL_SAFETY_CHECKLIST_TEMPLATE = HEADER + PATIENT + STAGE_HEADS + STAGES + SIGNATURES;
