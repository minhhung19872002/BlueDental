import { blank, header, signature, ticked } from "./sheetMarkup";

/*
 * Bảng kiểm an toàn phẫu thuật (MS PT-04) — the clinic's own paper form
 * (2026-11-16), the one sheet printed on A4 landscape, 10mm margins. The
 * reference has no such form.
 *
 * Its three stages stand side by side, each in a box, the boxes of their
 * titles joined by arrows. The table holding them is borderless (so its
 * blanks keep their dotted lines on paper, as the notes under the third stage
 * do); the stylesheet draws the boxes round every other column.
 */

const ID = "surgical-safety";
const text = (n: number) => `${ID}.text.${n}`;

/** A numbered tick box of this form and its printed label. */
let boxes = 0;
const tick = (label: string) => {
  boxes += 1;
  return ticked(`${ID}.check.${boxes}`, label);
};

const p = (body: string) => `<p>${body}</p>`;
/** A line under a heading, set in from it. */
const item = (body: string) => `<p style="padding-left: 14px;">${body}</p>`;
const both = (left: string, right: string) => `${tick(left)} &nbsp;&nbsp; ${tick(right)}`;

const stageHead = (title: string, who: string) =>
  `<td colspan="1" rowspan="1"><p style="text-align: center;"><strong>${title}</strong><br><em>(${who})</em></p></td>`;
const ARROW = '<td colspan="1" rowspan="1"><p style="text-align: center;">⟹</p></td>';
const stage = (body: string) => `<td colspan="1" rowspan="1">${body}</td>`;
const GAP = '<td colspan="1" rowspan="1"><p></p></td>';

const BEFORE_ANAESTHESIA = stage(
  p("<strong>Người bệnh đã được kiểm tra, xác nhận:</strong>") +
    item(tick("Họ và tên, tuổi, giới tính, mã người bệnh")) +
    item(tick("Vị trí phẫu thuật")) +
    item(tick("Phương pháp phẫu thuật dự kiến")) +
    item(tick("Giấy cam kết chấp nhận phẫu thuật, thủ thuật, GMHS")) +
    p(`<strong>Vùng mổ được đánh dấu:</strong> ${both("Có", "Không áp dụng")}`) +
    p(`<strong>Thuốc và thiết bị gây mê đầy đủ và sẵn sàng:</strong> ${tick("Có")}`) +
    p(`<strong>Máy đo bão hòa oxy trong máu gắn trên người bệnh và hoạt động bình thường:</strong> ${tick("Có")}`) +
    p(`<strong>Người bệnh có tiền sử dị ứng/say tàu xe:</strong> ${both("Có", "Không")}`) +
    p("<strong>Người bệnh có khó thở hoặc có nguy cơ sặc:</strong>") +
    item(tick("Không")) +
    item(tick("Có (thiết bị/dụng cụ hỗ trợ)")) +
    p("<strong>Người bệnh có nguy cơ mất &gt; 500ml máu (7ml/kg ở trẻ em):</strong>") +
    item(tick("Không")) +
    item(tick("Có, và có sẵn 2 đường truyền/tĩnh mạch trung tâm và dịch truyền/máu")),
);

const BEFORE_INCISION = stage(
  p(tick("Các thành viên trong kíp giới thiệu tên, nhiệm vụ")) +
    p(tick("Xác nhận lại họ tên người bệnh và vị trí rạch da")) +
    p(`<strong>Kháng sinh dự phòng:</strong> ${both("Có", "Không áp dụng")}`) +
    p("<strong>Dự kiến – Đối với phẫu thuật viên (PTV):</strong>") +
    item(tick("Những chú ý trong phẫu thuật hoặc diễn biến bất ngờ")) +
    item(tick("Thời gian phẫu thuật")) +
    item(tick("Dụng cụ đặc biệt dùng cho phẫu thuật")) +
    item(tick("Tiên lượng mất máu")) +
    p("<strong>Đối với Bác sỹ gây mê:</strong>") +
    item(tick("Điều cần chú ý trong gây mê ở người bệnh")) +
    p("<strong>Đối với nhóm Điều dưỡng:</strong>") +
    item(tick("Xác nhận tình trạng vô khuẩn bằng lời với các loại dụng cụ dùng cho phẫu thuật")) +
    p(`<strong>Thiết bị bị hỏng, bị thiếu:</strong> ${both("Có", "Không")}`) +
    p(`<strong>Chẩn đoán hình ảnh thiết yếu được chiếu:</strong> ${both("Có", "Không áp dụng")}`),
);

const notesLine = (n: number) => p(blank(text(n), 200, { full: true }));

const BEFORE_LEAVING = stage(
  p("<strong>Điều dưỡng viên xác nhận lại bằng lời:</strong>") +
    item(tick("Tên của phương pháp mổ")) +
    item(tick("Hoàn thành đếm gạc, kim và dụng cụ phẫu thuật")) +
    item(tick("Các vấn đề về dụng cụ cần giải quyết")) +
    p(
      "<strong>Dán nhãn bệnh phẩm</strong> (đọc to cả nhãn bệnh phẩm bao gồm cả tên người bệnh): " +
        both("Có", "Không áp dụng"),
    ) +
    p(
      "<strong>Đối với PTV, BS gây mê, điều dưỡng:</strong> Những vấn đề cần lưu ý đặc biệt về hồi tỉnh và chăm sóc sau mổ",
    ) +
    [1, 2, 3, 4, 5].map(notesLine).join(""),
);

const STAGES =
  '<table data-borderless="true" data-record-section="surgical-safety" style="width: 1047px;"><colgroup>' +
  '<col style="width: 333px;"><col style="width: 24px;"><col style="width: 333px;"><col style="width: 24px;"><col style="width: 333px;">' +
  "</colgroup><tbody>" +
  `<tr>${stageHead("TRƯỚC GÂY TÊ, GÂY MÊ", "Bác sĩ gây mê, KTV/điều dưỡng gây mê")}${ARROW}` +
  `${stageHead("TRƯỚC KHI RẠCH DA", "Điều dưỡng phòng mổ, Bác sĩ gây mê, PTV")}${ARROW}` +
  `${stageHead("TRƯỚC KHI RỜI KHỎI PHÒNG MỔ", "Điều dưỡng phòng mổ, Bác sĩ gây mê, PTV")}</tr>` +
  `<tr>${BEFORE_ANAESTHESIA}${GAP}${BEFORE_INCISION}${GAP}${BEFORE_LEAVING}</tr>` +
  "</tbody></table>";

const PATIENT =
  `<p>Họ và tên: ${blank(`${ID}.patient.name`, 300, { source: "patient.nameUppercase" })}` +
  ` &nbsp;&nbsp; Tuổi: ${blank(`${ID}.patient.age`, 56, { source: "patient.age" })}` +
  ` &nbsp;&nbsp; Giới tính: ${ticked(`${ID}.patient.gender-male`, "Nam", "patient.genderMale")}` +
  ` &nbsp; ${ticked(`${ID}.patient.gender-female`, "Nữ", "patient.genderFemale")}` +
  ` &nbsp;&nbsp; Mã NB: ${blank(`${ID}.patient.code-line`, 120, { source: "patient.code" })}</p>` +
  `<p>Chẩn đoán: ${blank(`${ID}.diagnosis`, 640)}` +
  ` &nbsp;&nbsp; Ngày ${blank(`${ID}.date.day`, 32)} tháng ${blank(`${ID}.date.month`, 32)}` +
  ` năm 20${blank(`${ID}.date.year`, 32)}</p>`;

export const SURGICAL_SAFETY_CHECKLIST_TEMPLATE =
  header([
    ["MS:", blank(`${ID}.form-code`, 120)],
    ["Số vào viện:", blank(`${ID}.admission-number`, 120)],
    ["Mã người bệnh:", blank(`${ID}.patient.code`, 120, { source: "patient.code" })],
  ]) +
  '<h1 style="text-align: center; line-height: 1.15;"><span style="font-size: 18pt;"><strong>BẢNG KIỂM AN TOÀN PHẪU THUẬT</strong></span></h1>' +
  PATIENT +
  STAGES +
  '<table data-borderless="true" data-record-section="signature" style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr>' +
  signature("ĐD chạy ngoài/vòng ngoài", text(6)) +
  signature("ĐD dụng cụ/vòng trong", text(7)) +
  signature("Phẫu thuật viên", text(8)) +
  "</tr></tbody></table>";
