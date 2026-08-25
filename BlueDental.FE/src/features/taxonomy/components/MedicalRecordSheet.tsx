import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

/**
 * The seventeen cells the reference lets a template fill in. Everything else on
 * the sheet is printed text, dotted rules or empty boxes the clinic writes on
 * by hand — those carry no state.
 */
export interface MedicalRecordFields {
  nextOfKin?: string;
  referralDiagnosis?: string;
  admissionReason?: string;
  illnessHistory?: string;
  personalHistory?: string;
  familyHistory?: string;
  generalExam?: string;
  specialistExam?: string;
  summaryProgress?: string;
  summaryTests?: string;
  mainDisease?: string;
  comorbidity?: string;
  treatmentMethod?: string;
  dischargeCondition?: string;
  followUpPlan?: string;
  caseSummary?: string;
  clinicDiagnosis?: string;
}

interface Props {
  value: MedicalRecordFields;
  onChange: (next: MedicalRecordFields) => void;
  /** 1 = 100%. The dialog's zoom control drives this. */
  zoom: number;
}

/** A4 at 96dpi, and the content width the reference lays its rows out on. */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1053;
/** Space between the sheets, matching the reference's stack. */
const PAGE_GAP = 16;

/** #FFFDE7 — the yellow the reference shades every editable cell with. */
const EDITABLE = "bd-a4-cellinput";

/** A rule the clinic writes on by hand: dotted, no shading, not editable. */
function Rule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bd-a4-rule", className)}
    />
  );
}

/** One of the small squares the printed form uses for digits. */
function GridBox() {
  return <span aria-hidden="true" className="bd-a4-gridbox" />;
}

/** A printed tick box. */
function TickBox({ checked }: { checked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="bd-a4-tickbox"
    >
      {checked ? "✓" : ""}
    </span>
  );
}

/**
 * One editable cell. Grows with what is typed, as the reference's does.
 *
 * Declared at module level, not inside the sheet: a component defined during
 * render is a new type on every render, so React would unmount and remount it
 * and the caret would jump out of the box on the first keystroke.
 */
function Cell({
  field,
  placeholder,
  value,
  onChange,
  className,
}: {
  field: keyof MedicalRecordFields;
  placeholder: string;
  value: MedicalRecordFields;
  onChange: (next: MedicalRecordFields) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = value[field] ?? "";

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(element.scrollHeight, 25)}px`;
  }, [text]);

  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={placeholder}
      placeholder={placeholder}
      value={text}
      onChange={(event) => onChange({ ...value, [field]: event.target.value })}
      className={cn(EDITABLE, className)}
    />
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="bd-a4-mt2 bd-a4-b">{children}</p>;
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT }}
      className="bd-a4-page"
    >
      {children}
    </div>
  );
}

/**
 * The A4 outpatient dental record the reference prints, with the cells a
 * template can pre-fill shaded yellow.
 *
 * Laid out at true A4 width and scaled with a transform rather than by changing
 * font sizes, so what is edited here is the shape that will be printed.
 */
export function MedicalRecordSheet({ value, onChange, zoom }: Props) {
  /** Three pages and the two gaps between them, before zoom. */
  const contentHeight = PAGE_HEIGHT * 3 + PAGE_GAP * 2;

  return (
    <div className="bd-a4-viewport">
      {/*
        A transform does not change the element's layout box, so the scaled
        sheet would keep claiming full A4 width and sit against the left edge.
        This outer box is the size the sheet actually appears at, which is what
        centres it and what the scroller measures.
      */}
      <div style={{ width: PAGE_WIDTH * zoom, height: contentHeight * zoom }} className="bd-a4-center">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: PAGE_WIDTH,
            gap: PAGE_GAP,
          }}
          className="bd-a4-col"
        >
          {/* ── Trang 1 ─────────────────────────────────────────────────── */}
          <Page>
            <div className="bd-a4-head">
              <div className="bd-a4-lh19">
                <p>Sở Y Tế TP.HCM</p>
                <p>PK RHM Thuộc Công Ty TNHH</p>
                <p className="bd-a4-b">Nha Khoa NFC Dental</p>
              </div>
              <div className="bd-a4-center-text">
                <h2 className="bd-a4-title">BỆNH ÁN NGOẠI TRÚ</h2>
                <h3 className="bd-a4-b">CHUYÊN KHOA RĂNG HÀM MẶT</h3>
              </div>
              <div className="bd-a4-meta">
                <p>Số ngoại trú: .........</p>
                <p>Số lưu trữ: ...........</p>
              </div>
            </div>

            <SectionTitle>I. HÀNH CHÍNH:</SectionTitle>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">1. Họ và tên (In hoa):</span>
              <span className="bd-a4-rule bd-a4-hint">
                (dữ liệu bệnh nhân)
              </span>
              <span className="bd-a4-nowrap">2. Sinh ngày:</span>
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
              </span>
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
              </span>
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
                <GridBox />
                <GridBox />
              </span>
              <span className="bd-a4-nowrap">Tuổi:</span>
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">3. Giới tính: 1. Nam</span>
              <TickBox />
              <span className="bd-a4-nowrap">2. Nữ</span>
              <TickBox />
              <span className="bd-a4-nowrap bd-a4-ml">4. Nghề nghiệp:</span>
              <Rule />
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">5. Dân tộc:</span>
              <Rule />
              <span className="bd-a4-nowrap">6. Ngoại kiều:</span>
              <Rule />
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">7. Địa chỉ: Số nhà</span>
              <Rule />
              <span className="bd-a4-nowrap">Thôn, phố</span>
              <Rule />
              <span className="bd-a4-nowrap">Xã, phường</span>
              <Rule />
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">Huyện (Q, Tx):</span>
              <Rule />
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
              </span>
              <span className="bd-a4-nowrap">Tỉnh, thành phố:</span>
              <Rule />
              <span className="bd-a4-boxes">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">8. Nơi làm việc:</span>
              <Rule />
              <span className="bd-a4-line bd-a4-nowrap">
                9. Đối tượng: 1. BHYT <TickBox /> 2. Thu Phí <TickBox /> 3. Miễn <TickBox /> 4. Khác{" "}
                <TickBox />
              </span>
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">
                10. BHYT giá trị đến ngày .... tháng .... năm ....... Số thẻ BHYT:
              </span>
              <Rule />
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">
                11. Họ tên, địa chỉ người nhà khi cần báo tin:
              </span>
              <Cell
                value={value}
                onChange={onChange}
                field="nextOfKin"
                placeholder={t("Nhập thông tin người nhà...")}
              />
            </div>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap bd-a4-push">Điện thoại số:</span>
              <Rule className="bd-a4-w420" />
            </div>

            <p className="bd-a4-mt1">
              12. Đến khám bệnh lúc .... giờ .... phút ngày .... tháng .... năm ........
            </p>

            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">13. Chẩn đoán và xử lý của nơi giới thiệu:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="referralDiagnosis"
                placeholder={t("Nhập chẩn đoán nơi giới thiệu...")}
              />
              <span className="bd-a4-line bd-a4-nowrap">
                1. Y tế <TickBox /> 2. Tự đến <TickBox checked />
              </span>
            </div>

            <SectionTitle>II. LÝ DO VÀO VIỆN:</SectionTitle>
            <Cell
              value={value}
              onChange={onChange}
              field="admissionReason"
              placeholder={t("Nhập lý do vào viện...")}
            />

            <SectionTitle>III. HỎI BỆNH:</SectionTitle>
            <div className="bd-a4-line">
              <span className="bd-a4-b bd-a4-nowrap">1. Quá trình bệnh lý:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="illnessHistory"
                placeholder={t("Nhập quá trình bệnh lý...")}
              />
            </div>

            <SectionTitle>2. Tiền sử bệnh:</SectionTitle>
            <div className="bd-a4-line">
              <span className="bd-a4-nowrap">+ Bản thân:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="personalHistory"
                placeholder={t("Nhập tiền sử bản thân...")}
              />
            </div>
            <div className="bd-a4-line bd-a4-mt1">
              <span className="bd-a4-nowrap">+ Gia đình:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="familyHistory"
                placeholder={t("Nhập tiền sử gia đình...")}
              />
            </div>

            <SectionTitle>IV. KHÁM BỆNH:</SectionTitle>

            <div className="bd-a4-mt1 bd-a4-split">
              <div className="bd-a4-flex1">
                <div className="bd-a4-line">
                  <span className="bd-a4-b bd-a4-nowrap">1. Toàn thân:</span>
                  <Cell
                    value={value}
                    onChange={onChange}
                    field="generalExam"
                    placeholder={t("Nhập khám toàn thân...")}
                  />
                </div>
                <div className="bd-a4-line bd-a4-mt3">
                  <Rule />
                </div>
                <div className="bd-a4-line bd-a4-mt3">
                  <Rule />
                </div>
              </div>

              {/* The vitals are a ruled box beside the examination notes, not a
                  row of their own under the heading. */}
              <div className="bd-a4-vitals">
                {[
                  ["Mạch:", "lần/phút"],
                  ["Nhiệt độ:", "°C"],
                  ["Huyết áp:", "mmHg"],
                  ["Nhịp thở:", "lần/phút"],
                  ["Cân nặng:", "Kg"],
                ].map(([label, unit]) => (
                  <div key={label} className="bd-a4-line bd-a4-line--pad">
                    <span className="bd-a4-nowrap">{label}</span>
                    <Rule />
                    <span className="bd-a4-nowrap">{unit}</span>
                  </div>
                ))}
              </div>
            </div>

            <SectionTitle>2. Bệnh chuyên khoa:</SectionTitle>
            <Cell
              value={value}
              onChange={onChange}
              field="specialistExam"
              placeholder={t("Nhập khám chuyên khoa...")}
            />
            <div className="bd-a4-line bd-a4-mt1">
              <Rule />
            </div>
            <div className="bd-a4-line bd-a4-mt1">
              <Rule />
            </div>
          </Page>

          {/* ── Trang 2 ─────────────────────────────────────────────────── */}
          <Page>
            <h2 className="bd-a4-subtitle">TỔNG KẾT BỆNH ÁN:</h2>

            <p className="bd-a4-mt2">1. Quá trình bệnh lý và diễn biến lâm sàng:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="summaryProgress"
              placeholder={t("Nhập quá trình bệnh lý...")}
            />

            <p className="bd-a4-mt2">2. Tóm tắt kết quả xét nghiệm cận lâm sàng có giá trị chẩn đoán:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="summaryTests"
              placeholder={t("Nhập kết quả xét nghiệm...")}
            />

            <p className="bd-a4-mt2">3. Chẩn đoán ra viện:</p>
            <p>- Bệnh chính:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="mainDisease"
              placeholder={t("Nhập bệnh chính...")}
            />
            <p className="bd-a4-mt2">- Bệnh kèm theo:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="comorbidity"
              placeholder={t("Nhập bệnh kèm theo...")}
            />

            <p className="bd-a4-mt2">4. Phương pháp điều trị:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="treatmentMethod"
              placeholder={t("Nhập phương pháp điều trị...")}
            />

            <p className="bd-a4-mt2">5. Tình trạng người bệnh ra viện:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="dischargeCondition"
              placeholder={t("Nhập tình trạng ra viện...")}
            />

            <p className="bd-a4-mt2">6. Hướng điều trị và các chế độ tiếp theo:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="followUpPlan"
              placeholder={t("Nhập hướng điều trị tiếp...")}
            />

            <table className="bd-a4-table">
              <tbody>
                <tr>
                  <td colSpan={2} className="bd-a4-cell bd-a4-b">
                    Hồ sơ, phim, ảnh
                  </td>
                  <td className="bd-a4-cell">Người giao hồ sơ</td>
                  <td className="bd-a4-cell">
                    Ngày ... tháng ... năm ...
                    <br />
                    <span className="bd-a4-b">Bác sỹ điều trị</span>
                  </td>
                </tr>
                <tr>
                  <td className="bd-a4-cell bd-a4-cell--sm bd-a4-cell--left bd-a4-w38">Loại</td>
                  <td className="bd-a4-cell bd-a4-cell--sm bd-a4-cell--left bd-a4-w14">Số tờ</td>
                  <td rowSpan={7} className="bd-a4-cell bd-a4-cell--lg bd-a4-cell--left bd-a4-top bd-a4-w24">
                    <p>Người giao hồ sơ:</p>
                    <div className="bd-a4-line bd-a4-mt2">
                      <span className="bd-a4-nowrap">Họ tên:</span>
                      <Rule />
                    </div>
                    <p className="bd-a4-mt4">Người nhận hồ sơ:</p>
                    <div className="bd-a4-line bd-a4-mt2">
                      <span className="bd-a4-nowrap">Họ tên:</span>
                      <Rule />
                    </div>
                  </td>
                  <td rowSpan={7} className="bd-a4-cell bd-a4-cell--lg bd-a4-cell--left bd-a4-mid bd-a4-w24">
                    <div className="bd-a4-line">
                      <span className="bd-a4-nowrap">Họ tên:</span>
                      <Rule />
                    </div>
                  </td>
                </tr>
                {[
                  "- X - quang",
                  "- CT Scanner",
                  "- Siêu âm",
                  "- Xét nghiệm",
                  "- Khác",
                  "- Toàn bộ hồ sơ",
                ].map((row) => (
                  <tr key={row}>
                    <td className="bd-a4-cell bd-a4-cell--tight bd-a4-cell--left bd-a4-th">{row}</td>
                    <td className="bd-a4-cell bd-a4-cell--tight" />
                  </tr>
                ))}
              </tbody>
            </table>
          </Page>

          {/* ── Trang 3 ─────────────────────────────────────────────────── */}
          <Page>
            <p>3. Hình vẽ mô tả tổn thương khi vào viện</p>

            <div className="bd-a4-mt2 bd-a4-split">
              <div className="bd-a4-flex1">
                <div className="bd-a4-tickrow bd-a4-b">
                  <span>Phải</span>
                  <span>Thẳng</span>
                  <span>Trái</span>
                  <span>
                    Hàm trên và
                    <br />
                    Họng
                  </span>
                  <span>Hàm dưới</span>
                </div>
                {/* The clinic draws on this by hand, exactly as the printed form
                  intends; nothing here is captured by the template. */}
                <div aria-hidden="true" className="bd-a4-writebox" />
              </div>

              <div className="bd-a4-w245">
                <p className="bd-a4-b">Phân loại khe hở môi vòm miệng</p>
                <ol className="bd-a4-list">
                  <li>1 và 4 là khe hở môi</li>
                  <li>2 và 5 là khe hở xương ổ răng</li>
                  <li>3 và 6 là khe hở cung hàm</li>
                  <li>7 và 8 là khe hở vòm miệng cứng</li>
                  <li>9 là khe hở vòm miệng mềm</li>
                </ol>
              </div>
            </div>

            <p className="bd-a4-mt3">4. Tóm tắt bệnh án:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="caseSummary"
              placeholder={t("Nhập tóm tắt bệnh án...")}
            />

            <p className="bd-a4-mt2">5. Chẩn đoán của khoa khám bệnh:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="clinicDiagnosis"
              placeholder={t("Nhập chẩn đoán khoa khám bệnh...")}
            />

            <p className="bd-a4-mt2">6. Đã xử lý của tuyến dưới:</p>
            <div className="bd-a4-line bd-a4-mt4">
              <Rule />
            </div>

            <p className="bd-a4-mt3">7. Điều trị ngoại trú từ ngày ... đến ngày ...</p>

            <div className="bd-a4-signrow">
              {["ĐẠI DIỆN CƠ SỞ KHÁM CHỮA BỆNH", "BÁC SỸ KHÁM BỆNH"].map((role) => (
                <div key={role} className="bd-a4-w46">
                  <p className="bd-a4-b">{role}</p>
                  <div className="bd-a4-line bd-a4-mt16">
                    <span className="bd-a4-nowrap">Họ và tên:</span>
                    <Rule />
                  </div>
                </div>
              ))}
            </div>
          </Page>
        </div>
      </div>
    </div>
  );
}
