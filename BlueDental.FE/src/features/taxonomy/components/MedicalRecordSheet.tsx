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
const EDITABLE =
  "w-full resize-none overflow-hidden border-0 border-b border-dotted border-black bg-[#FFFDE7] px-1 py-0.5 text-[14px] leading-[19.6px] text-black outline-none placeholder:text-black/35 placeholder:italic focus:bg-[#FFF9C4]";

/** A rule the clinic writes on by hand: dotted, no shading, not editable. */
function Rule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-[19px] flex-1 border-b border-dotted border-black", className)}
    />
  );
}

/** One of the small squares the printed form uses for digits. */
function GridBox() {
  return <span aria-hidden="true" className="inline-block size-5 border border-black" />;
}

/** A printed tick box. */
function TickBox({ checked }: { checked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-[15px] items-center justify-center border border-black text-[11px] leading-none"
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
  return <p className="mt-2 font-bold">{children}</p>;
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT }}
      className="bg-white px-[45px] py-[40px] text-[14px] leading-[19.6px] text-black shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
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
    <div className="overflow-auto rounded-lg border border-app-line bg-[#E9EDF3] p-4">
      {/*
        A transform does not change the element's layout box, so the scaled
        sheet would keep claiming full A4 width and sit against the left edge.
        This outer box is the size the sheet actually appears at, which is what
        centres it and what the scroller measures.
      */}
      <div style={{ width: PAGE_WIDTH * zoom, height: contentHeight * zoom }} className="mx-auto">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: PAGE_WIDTH,
            gap: PAGE_GAP,
          }}
          className="flex flex-col"
        >
          {/* ── Trang 1 ─────────────────────────────────────────────────── */}
          <Page>
            <div className="flex items-start justify-between">
              <div className="leading-[19px]">
                <p>Sở Y Tế TP.HCM</p>
                <p>PK RHM Thuộc Công Ty TNHH</p>
                <p className="font-bold">Nha Khoa NFC Dental</p>
              </div>
              <div className="text-center">
                <h2 className="text-[18px] leading-[25px] font-bold">BỆNH ÁN NGOẠI TRÚ</h2>
                <h3 className="font-bold">CHUYÊN KHOA RĂNG HÀM MẶT</h3>
              </div>
              <div className="text-right text-[12px] leading-[18px]">
                <p>Số ngoại trú: .........</p>
                <p>Số lưu trữ: ...........</p>
              </div>
            </div>

            <SectionTitle>I. HÀNH CHÍNH:</SectionTitle>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">1. Họ và tên (In hoa):</span>
              <span className="flex-1 border-b border-dotted border-black text-black/45 italic">
                (dữ liệu bệnh nhân)
              </span>
              <span className="whitespace-nowrap">2. Sinh ngày:</span>
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
              </span>
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
              </span>
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
                <GridBox />
                <GridBox />
              </span>
              <span className="whitespace-nowrap">Tuổi:</span>
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">3. Giới tính: 1. Nam</span>
              <TickBox />
              <span className="whitespace-nowrap">2. Nữ</span>
              <TickBox />
              <span className="ml-2 whitespace-nowrap">4. Nghề nghiệp:</span>
              <Rule />
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">5. Dân tộc:</span>
              <Rule />
              <span className="whitespace-nowrap">6. Ngoại kiều:</span>
              <Rule />
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">7. Địa chỉ: Số nhà</span>
              <Rule />
              <span className="whitespace-nowrap">Thôn, phố</span>
              <Rule />
              <span className="whitespace-nowrap">Xã, phường</span>
              <Rule />
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">Huyện (Q, Tx):</span>
              <Rule />
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
              </span>
              <span className="whitespace-nowrap">Tỉnh, thành phố:</span>
              <Rule />
              <span className="flex gap-[2px]">
                <GridBox />
                <GridBox />
              </span>
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">8. Nơi làm việc:</span>
              <Rule />
              <span className="flex items-end gap-1 whitespace-nowrap">
                9. Đối tượng: 1. BHYT <TickBox /> 2. Thu Phí <TickBox /> 3. Miễn <TickBox /> 4. Khác{" "}
                <TickBox />
              </span>
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">
                10. BHYT giá trị đến ngày .... tháng .... năm ....... Số thẻ BHYT:
              </span>
              <Rule />
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">
                11. Họ tên, địa chỉ người nhà khi cần báo tin:
              </span>
              <Cell
                value={value}
                onChange={onChange}
                field="nextOfKin"
                placeholder={t("Nhập thông tin người nhà...")}
              />
            </div>

            <div className="mt-1 flex items-end gap-1">
              <span className="ml-auto whitespace-nowrap">Điện thoại số:</span>
              <Rule className="max-w-[420px]" />
            </div>

            <p className="mt-1">
              12. Đến khám bệnh lúc .... giờ .... phút ngày .... tháng .... năm ........
            </p>

            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">13. Chẩn đoán và xử lý của nơi giới thiệu:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="referralDiagnosis"
                placeholder={t("Nhập chẩn đoán nơi giới thiệu...")}
              />
              <span className="flex items-end gap-1 whitespace-nowrap">
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
            <div className="flex items-end gap-1">
              <span className="font-bold whitespace-nowrap">1. Quá trình bệnh lý:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="illnessHistory"
                placeholder={t("Nhập quá trình bệnh lý...")}
              />
            </div>

            <SectionTitle>2. Tiền sử bệnh:</SectionTitle>
            <div className="flex items-end gap-1">
              <span className="whitespace-nowrap">+ Bản thân:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="personalHistory"
                placeholder={t("Nhập tiền sử bản thân...")}
              />
            </div>
            <div className="mt-1 flex items-end gap-1">
              <span className="whitespace-nowrap">+ Gia đình:</span>
              <Cell
                value={value}
                onChange={onChange}
                field="familyHistory"
                placeholder={t("Nhập tiền sử gia đình...")}
              />
            </div>

            <SectionTitle>IV. KHÁM BỆNH:</SectionTitle>

            <div className="mt-1 flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-end gap-1">
                  <span className="font-bold whitespace-nowrap">1. Toàn thân:</span>
                  <Cell
                    value={value}
                    onChange={onChange}
                    field="generalExam"
                    placeholder={t("Nhập khám toàn thân...")}
                  />
                </div>
                <div className="mt-3 flex items-end gap-1">
                  <Rule />
                </div>
                <div className="mt-3 flex items-end gap-1">
                  <Rule />
                </div>
              </div>

              {/* The vitals are a ruled box beside the examination notes, not a
                  row of their own under the heading. */}
              <div className="w-[250px] shrink-0 border border-black px-3 py-2">
                {[
                  ["Mạch:", "lần/phút"],
                  ["Nhiệt độ:", "°C"],
                  ["Huyết áp:", "mmHg"],
                  ["Nhịp thở:", "lần/phút"],
                  ["Cân nặng:", "Kg"],
                ].map(([label, unit]) => (
                  <div key={label} className="flex items-end gap-1 py-[3px]">
                    <span className="whitespace-nowrap">{label}</span>
                    <Rule />
                    <span className="whitespace-nowrap">{unit}</span>
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
            <div className="mt-1 flex items-end gap-1">
              <Rule />
            </div>
            <div className="mt-1 flex items-end gap-1">
              <Rule />
            </div>
          </Page>

          {/* ── Trang 2 ─────────────────────────────────────────────────── */}
          <Page>
            <h2 className="text-[16px] font-bold">TỔNG KẾT BỆNH ÁN:</h2>

            <p className="mt-2">1. Quá trình bệnh lý và diễn biến lâm sàng:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="summaryProgress"
              placeholder={t("Nhập quá trình bệnh lý...")}
            />

            <p className="mt-2">2. Tóm tắt kết quả xét nghiệm cận lâm sàng có giá trị chẩn đoán:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="summaryTests"
              placeholder={t("Nhập kết quả xét nghiệm...")}
            />

            <p className="mt-2">3. Chẩn đoán ra viện:</p>
            <p>- Bệnh chính:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="mainDisease"
              placeholder={t("Nhập bệnh chính...")}
            />
            <p className="mt-2">- Bệnh kèm theo:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="comorbidity"
              placeholder={t("Nhập bệnh kèm theo...")}
            />

            <p className="mt-2">4. Phương pháp điều trị:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="treatmentMethod"
              placeholder={t("Nhập phương pháp điều trị...")}
            />

            <p className="mt-2">5. Tình trạng người bệnh ra viện:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="dischargeCondition"
              placeholder={t("Nhập tình trạng ra viện...")}
            />

            <p className="mt-2">6. Hướng điều trị và các chế độ tiếp theo:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="followUpPlan"
              placeholder={t("Nhập hướng điều trị tiếp...")}
            />

            <table className="mt-6 w-full border-collapse text-center">
              <tbody>
                <tr>
                  <td colSpan={2} className="border border-black px-2 py-2 font-bold">
                    Hồ sơ, phim, ảnh
                  </td>
                  <td className="border border-black px-2 py-2">Người giao hồ sơ</td>
                  <td className="border border-black px-2 py-2">
                    Ngày ... tháng ... năm ...
                    <br />
                    <span className="font-bold">Bác sỹ điều trị</span>
                  </td>
                </tr>
                <tr>
                  <td className="w-[38%] border border-black px-2 py-1 text-left">Loại</td>
                  <td className="w-[14%] border border-black px-2 py-1 text-left">Số tờ</td>
                  <td rowSpan={7} className="w-[24%] border border-black px-3 py-2 text-left align-top">
                    <p>Người giao hồ sơ:</p>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="whitespace-nowrap">Họ tên:</span>
                      <Rule />
                    </div>
                    <p className="mt-4">Người nhận hồ sơ:</p>
                    <div className="mt-2 flex items-end gap-1">
                      <span className="whitespace-nowrap">Họ tên:</span>
                      <Rule />
                    </div>
                  </td>
                  <td rowSpan={7} className="w-[24%] border border-black px-3 py-2 text-left align-middle">
                    <div className="flex items-end gap-1">
                      <span className="whitespace-nowrap">Họ tên:</span>
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
                    <td className="h-7 border border-black px-2 text-left">{row}</td>
                    <td className="border border-black px-2" />
                  </tr>
                ))}
              </tbody>
            </table>
          </Page>

          {/* ── Trang 3 ─────────────────────────────────────────────────── */}
          <Page>
            <p>3. Hình vẽ mô tả tổn thương khi vào viện</p>

            <div className="mt-2 flex gap-4">
              <div className="flex-1">
                <div className="flex gap-6 font-bold">
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
                <div aria-hidden="true" className="mt-1 h-[105px] border border-black" />
              </div>

              <div className="w-[245px] shrink-0">
                <p className="font-bold">Phân loại khe hở môi vòm miệng</p>
                <ol className="mt-1 list-inside list-decimal text-[13px] leading-[16px]">
                  <li>1 và 4 là khe hở môi</li>
                  <li>2 và 5 là khe hở xương ổ răng</li>
                  <li>3 và 6 là khe hở cung hàm</li>
                  <li>7 và 8 là khe hở vòm miệng cứng</li>
                  <li>9 là khe hở vòm miệng mềm</li>
                </ol>
              </div>
            </div>

            <p className="mt-3">4. Tóm tắt bệnh án:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="caseSummary"
              placeholder={t("Nhập tóm tắt bệnh án...")}
            />

            <p className="mt-2">5. Chẩn đoán của khoa khám bệnh:</p>
            <Cell
              value={value}
              onChange={onChange}
              field="clinicDiagnosis"
              placeholder={t("Nhập chẩn đoán khoa khám bệnh...")}
            />

            <p className="mt-2">6. Đã xử lý của tuyến dưới:</p>
            <div className="mt-4 flex items-end gap-1">
              <Rule />
            </div>

            <p className="mt-3">7. Điều trị ngoại trú từ ngày ... đến ngày ...</p>

            <div className="mt-10 flex justify-between">
              {["ĐẠI DIỆN CƠ SỞ KHÁM CHỮA BỆNH", "BÁC SỸ KHÁM BỆNH"].map((role) => (
                <div key={role} className="w-[46%]">
                  <p className="font-bold">{role}</p>
                  <div className="mt-16 flex items-end gap-1">
                    <span className="whitespace-nowrap">Họ và tên:</span>
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
