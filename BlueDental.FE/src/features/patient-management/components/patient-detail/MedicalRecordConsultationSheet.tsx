import type { CSSProperties } from "react";
import { t } from "@/lib/i18n";

/**
 * "Phiếu Tư Vấn Tổng Quát" — drawn to the reference's printed layout.
 *
 * The reference's sheet carries no input at all: it is printed and then filled
 * in by hand, so there is nothing here to type into and nothing to save. The
 * blank runs are dotted rules, exactly as they print.
 */

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1053;

interface Props {
  zoom: number;
  /** The branch this is printed at; its letterhead sits top-left. */
  clinic?: { name: string; address: string | null; phone: string | null };
}

/** A run the clinic writes on by hand. */
function Rule({ grow }: { grow?: boolean }) {
  return <span aria-hidden="true" className={grow ? "bd-a4-rule pd-rule-grow" : "bd-a4-rule"} />;
}

const WISHES = [
  "1. Tiếp tục điều trị tại phòng khám theo phương thức đã giải thích",
  "2. Tiếp tục điều trị, không xét nghiệm hay can thiệp gì thêm",
  "3. Khác",
];

const EXPLAINED = [
  "Chẩn đoán:",
  "Phương pháp điều trị:",
  "Tình trạng bệnh nhân hiện nay:",
];

export function MedicalRecordConsultationSheet({ zoom, clinic }: Props) {
  return (
    <div
      className="bd-a4-viewport pd-a4-consult"
      style={{ width: PAGE_WIDTH * zoom + 34, "--sheet-zoom": zoom } as CSSProperties}
    >
      <div className="bd-a4-page bd-a4-center" style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT }}>
        <header className="pd-consult-head">
          <b>{clinic?.name ?? ""}</b>
          <span>{clinic?.address ?? ""}</span>
          <span>
            {t("ĐT")}: {clinic?.phone ?? ""}
          </span>
        </header>

        <h2 className="pd-consult-title">{t("PHIẾU TƯ VẤN")}</h2>

        <p className="pd-consult-line">
          {t("Lúc")} <Rule /> {t("giờ")} {t("Ngày")} <Rule /> {t("tháng")} <Rule /> {t("năm")}{" "}
          <Rule />, {t("tại")} {clinic?.name ?? ""}
        </p>

        <p className="pd-consult-line">
          {t("Chúng tôi là")}: 1. {t("Bác sĩ")}: <Rule grow />
        </p>
        <p className="pd-consult-line">
          {t("Chức vụ")}: <Rule grow />
        </p>
        <p className="pd-consult-line">
          2. <Rule grow />
        </p>
        <p className="pd-consult-line">
          {t("Chức vụ")}: <Rule grow />
        </p>

        <p className="pd-consult-line">
          {t("Đã tiếp xúc tư vấn, giải thích cho bệnh nhân/thân nhân bệnh nhân")}: <Rule grow />
        </p>
        <p className="pd-consult-line">
          {t("Sinh năm")}: <Rule /> {t("Địa chỉ")}: <Rule grow />
        </p>
        <p className="pd-consult-line">
          {t("Số hồ sơ y tế")}: <Rule grow />
        </p>
        <p className="pd-consult-line">
          {t("Ngày thực hiện")}: <Rule grow />
        </p>

        <h3 className="pd-consult-section">{t("NỘI DUNG TIẾP XÚC - TƯ VẤN – GIẢI THÍCH")}</h3>
        <p className="pd-consult-line">
          {t("Phòng khám đã cung cấp thông tin, giải thích, tư vấn chẩn đoán, điều trị như sau:")}
        </p>
        {EXPLAINED.map((label) => (
          <p className="pd-consult-line" key={label}>
            {t(label)} <Rule grow />
          </p>
        ))}
        <p className="pd-consult-line">
          {t(
            "Tiên lượng và nguy cơ: (Phản ứng thuốc tê, chảy máu, nhiễm trùng, tử vong, tỉ lệ các biến chứng, thời gian phục hồi)",
          )}
        </p>
        <Rule grow />

        <p className="pd-consult-line">{t("Ước tính chi phí khám chữa bệnh:")}</p>
        <p className="pd-consult-line">
          {t("1. Chi phí thủ thuật/dụng cụ dùng cho kỹ thuật cao (nếu có):")} <Rule grow />
        </p>
        <p className="pd-consult-line">
          {t("2. Chi phí khác (thuốc, vật tư y tế, xét nghiệm, siêu âm, …): theo thực tế sử dụng.")}
        </p>

        <p className="pd-consult-line">{t("Ý kiến người bệnh/thân nhân người bệnh:")}</p>
        <p className="pd-consult-line">
          {t("Sau khi nghe bác sĩ tư vấn giải thích, tôi và các thành viên gia đình mong muốn:")}
        </p>
        {WISHES.map((wish) => (
          <p className="pd-consult-line" key={wish}>
            {t(wish)} <Rule grow />
          </p>
        ))}

        <p className="pd-consult-body">
          {t(
            "Bệnh nhân/thân nhân người bệnh sau khi nghe giải thích đã hiểu rõ bệnh lý, phương pháp điều trị, chi phí điều trị. Tôi chấp nhận các rủi ro và chịu trách nhiệm với lựa chọn trên và cam kết thực hiện đầy đủ các nghĩa vụ của người bệnh theo quy định của pháp luật và quy định của phòng khám.",
          )}
        </p>

        <div className="pd-consult-signs">
          <p>
            <b>{t("Bác sĩ điều trị")}</b>
          </p>
          <p>
            <b>{t("Người bệnh/Thân nhân")}</b>
          </p>
        </div>
      </div>
    </div>
  );
}
