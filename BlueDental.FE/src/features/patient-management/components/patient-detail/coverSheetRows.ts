/**
 * The printed body of "Bìa hồ sơ bệnh án", the Ministry of Health's standard
 * medical-record cover. Transcribed from the reference's own sheet — see
 * docs/clone/pages/patient-detail.md §Bệnh án.
 *
 * These are the form's printed headings; nothing here is patient data.
 */

/**
 * "Thành phần và thứ tự sắp xếp các mẫu giấy, phiếu trong hồ sơ bệnh án".
 *
 * The two "Số lượng (ngày)" columns carry no field on the reference — they are
 * printed blanks, written on by hand — so they are drawn empty here too.
 */
export const COVER_CONTENT_ROWS: { numeral: string; label: string }[] = [
  {
    numeral: "I.",
    label:
      "Thông tin hành chính, mẫu cam kết, tài liệu của cơ sở khám bệnh, chữa bệnh chuyển đến",
  },
  { numeral: "II.", label: "Các bệnh án (Nội khoa, ngoại khoa, sản khoa, nhi khoa,...)" },
  { numeral: "III.", label: "Giấy, phiếu chỉ định xét nghiệm, cận lâm sàng, kết quả" },
  { numeral: "IV.", label: "Giấy, phiếu khám, đánh giá, theo dõi của bác sỹ" },
  { numeral: "V.", label: "Giấy, phiếu đánh giá, theo dõi, chăm sóc của điều dưỡng" },
  { numeral: "VI.", label: "Giấy, phiếu gây mê, phẫu thuật, thủ thuật" },
  {
    numeral: "VII.",
    label: "Giấy, phiếu chuyển viện, ra viện, bản tóm tắt hồ sơ bệnh án",
  },
  { numeral: "VIII.", label: "Các mẫu giấy, phiếu khác" },
];

/**
 * "Phần kiểm soát của đơn vị nhận và lưu trữ hồ sơ bệnh án".
 *
 * Laid out as two Nội dung / Đầy đủ-Đạt columns side by side, so the items are
 * paired across each row. An empty right-hand label still carries its tick box
 * — the reference draws one there — and "6. Thanh toán ra viện" is ticked on
 * its own heading row, with no items beneath it.
 */
export interface CoverControlGroup {
  heading: string;
  /** True when the heading row itself carries the tick box. */
  headingTick?: boolean;
  /** `[left, right]`; an empty string is a blank cell that still ticks. */
  pairs: [string, string][];
}

export const COVER_CONTROL_GROUPS: CoverControlGroup[] = [
  {
    heading: "1. Phần hành chính",
    pairs: [["Thông tin hành chính", "Thông tin khám, chữa bệnh ban đầu"]],
  },
  {
    heading: "2. Phần tổng kết bệnh án ra viện",
    pairs: [
      ["Nội dung đầy đủ", "Tình trạng ra viện"],
      ["Mã hóa ICD đầy đủ", ""],
    ],
  },
  { heading: "3. Cận lâm sàng", pairs: [["Chỉ định", "Kết quả"]] },
  {
    heading: "4. Phiếu theo dõi, chăm sóc của điều dưỡng",
    pairs: [["Đầy đủ các phiếu", "Xử trí, can thiệp của điều dưỡng"]],
  },
  {
    heading: "5. Phẫu thuật, thủ thuật, gây mê hồi sức",
    pairs: [
      [
        "Hội chẩn phẫu thuật có sự tham gia của bác sỹ gây mê, phẫu thuật viên",
        "Đầy đủ các phiếu gây mê, hồi tỉnh",
      ],
      [
        "Giấy cam kết chấp thuận phẫu thuật, thủ thuật và gây mê hồi sức",
        "Bảng kiểm an toàn phẫu thuật",
      ],
    ],
  },
  { heading: "6. Thanh toán ra viện", headingTick: true, pairs: [] },
];

/**
 * The three outcome lines under "Phân loại bệnh án / Ngày nhận HSBA". Each has
 * a tick box and a `..../..../20....` the clinic dates by hand.
 */
export const COVER_OUTCOME_ROWS: string[] = [
  "Bệnh án chưa đạt lần 1: Trả lại khoa",
  "Bệnh án chưa đạt lần 2: Trả lại khoa",
  "Bệnh án đạt yêu cầu: chuyển lưu trữ",
];
