import { Fragment, type CSSProperties } from "react";
import { t } from "@/lib/i18n";
import type { SheetFields } from "./medicalRecordDraft";
import { COVER_CONTENT_ROWS, COVER_CONTROL_GROUPS, COVER_OUTCOME_ROWS } from "./coverSheetRows";

/**
 * "Bìa hồ sơ bệnh án" — the Ministry of Health's standard record cover, drawn
 * to the reference's printed layout.
 *
 * Two sides: the cover itself, then the two control tables and the handover
 * signatures. The patient's identity is printed from their record, as the
 * reference prints it; everything else is typed or ticked here.
 */

/** A4 at 96dpi, the paper every sheet in Bệnh án uses. */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1053;

interface CoverPatient {
  patientCode: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: number;
  address: string | null;
}

interface Props {
  value: SheetFields;
  onChange: (next: SheetFields) => void;
  zoom: number;
  patient?: CoverPatient;
}

function ageOf(dob: string | null): string {
  if (!dob) return "";
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? String(age) : "";
}

export function MedicalRecordCoverSheet({ value, onChange, zoom, patient }: Props) {
  const dob = patient?.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  const dobValid = dob && !Number.isNaN(dob.getTime()) ? dob : null;
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const set = (key: keyof SheetFields) => (next: string) => onChange({ ...value, [key]: next });
  const cell = (key: keyof SheetFields, className = "bd-a4-cellinput", seed = "") => (
    <input
      className={className}
      aria-label={t(String(key))}
      value={(value[key] as string | undefined) ?? seed}
      onChange={(event) => set(key)(event.target.value)}
    />
  );
  const dateParts = (prefix: string) => (
    <span className="pd-cover-date">
      {t("Ngày")} {cell(`${prefix}Day` as keyof SheetFields, "bd-a4-cellinput pd-cover-datecell")}
      {t("tháng")} {cell(`${prefix}Month` as keyof SheetFields, "bd-a4-cellinput pd-cover-datecell")}
      {t("năm 20")} {cell(`${prefix}Year` as keyof SheetFields, "bd-a4-cellinput pd-cover-datecell")}
    </span>
  );
  const tick = (key: string) => (
    <input
      type="checkbox"
      className="bd-a4-checkbox"
      aria-label={key}
      checked={value[key as keyof SheetFields] === "1"}
      onChange={(event) => onChange({ ...value, [key]: event.target.checked ? "1" : "" })}
    />
  );

  return (
    <div
      className="bd-a4-viewport pd-a4-cover"
      style={{ width: PAGE_WIDTH * zoom + 34, "--sheet-zoom": zoom } as CSSProperties}
    >
      <div className="bd-a4-page bd-a4-center" style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT }}>
        <div className="pd-cover-frame">
          <header className="pd-cover-org">
            <p>{t("SỞ Y TẾ THÀNH PHỐ HỒ CHÍ MINH")}</p>
            <p>{t("PHÒNG KHÁM CHUYÊN KHOA RĂNG HÀM MẶT")}</p>
            <p>{cell("clinicLine", "bd-a4-cellinput pd-cover-orgline")}</p>
          </header>

          <dl className="pd-cover-codes">
            <div>
              <dt>{t("MÃ BỆNH NHÂN")}:</dt>
              <dd>{cell("patientCode", "bd-a4-cellinput", patient?.patientCode ?? "")}</dd>
            </div>
            <div>
              <dt>{t("MÃ LƯU TRỮ")}:</dt>
              <dd>{cell("archiveCode")}</dd>
            </div>
          </dl>

          <h2 className="pd-cover-title">{t("BỆNH ÁN")}</h2>
          <p className="pd-cover-year">
            {t("NĂM 20")}
            {cell("year", "bd-a4-cellinput pd-cover-year-in")}
          </p>

          <div className="pd-cover-identity">
            <p>
              <span>{t("HỌ VÀ TÊN (In hoa)")}:</span>
              {cell("fullName", "bd-a4-cellinput pd-cover-grow", patient?.fullName.toUpperCase() ?? "")}
              <label>
                {tick("male")} {t("Nam")}
              </label>
              <label>
                {tick("female")} {t("Nữ")}
              </label>
            </p>
            <p>
              <span>{t("Ngày sinh")}:</span>
              {cell("dobDay", "bd-a4-cellinput pd-cover-datecell", dobValid ? pad2(dobValid.getDate()) : "")}
              /
              {cell("dobMonth", "bd-a4-cellinput pd-cover-datecell", dobValid ? pad2(dobValid.getMonth() + 1) : "")}
              /
              {cell("dobYear", "bd-a4-cellinput pd-cover-datecell", dobValid ? String(dobValid.getFullYear()) : "")}
              <span>{t("Tuổi")}:</span>
              {cell("age", "bd-a4-cellinput pd-cover-datecell", ageOf(patient?.dateOfBirth ?? null))}
            </p>
            <p>
              <span>{t("Địa chỉ")}:</span>
              {cell("address", "bd-a4-cellinput pd-cover-grow", patient?.address ?? "")}
            </p>
            <p>
              <span>{t("Ngày bắt đầu điều trị")}:</span>
              {dateParts("treatmentStart")}
            </p>
            <p>
              <span>{t("Ngày kết thúc điều trị")}:</span>
              {dateParts("treatmentEnd")}
            </p>
          </div>

          <dl className="pd-cover-films">
            <div>
              <dt>{t("MÃ BỆNH")}:</dt>
              <dd>{cell("diseaseCode")}</dd>
            </div>
            <div>
              <dt>{t("SỐ PHIM XQ")}:</dt>
              <dd>{cell("filmXq")}</dd>
            </div>
            <div>
              <dt>{t("SỐ PHIM CT")}:</dt>
              <dd>{cell("filmCt")}</dd>
            </div>
            <div>
              <dt>{t("SỐ PHIM KHÁC")}:</dt>
              <dd>{cell("filmOther")}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bd-a4-page bd-a4-center" style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT }}>
        <h3 className="pd-cover-subtitle">
          {t("Thành phần và thứ tự sắp xếp các mẫu giấy, phiếu trong hồ sơ bệnh án")}
        </h3>
        <table className="pd-cover-table">
          <thead>
            <tr>
              <th style={{ width: 52 }}>{t("TT")}</th>
              <th>{t("Nội dung")}</th>
              <th style={{ width: 96 }}>{t("Số lượng (ngày)")}</th>
              <th style={{ width: 96 }}>{t("Số lượng (ngày)")}</th>
            </tr>
          </thead>
          <tbody>
            {COVER_CONTENT_ROWS.map((row) => (
              <tr key={row.numeral}>
                <td className="pd-cover-num">{row.numeral}</td>
                <td>{t(row.label)}</td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="pd-cover-subtitle">
          {t("Phần kiểm soát của đơn vị nhận và lưu trữ hồ sơ bệnh án")}
        </h3>
        <table className="pd-cover-table">
          <thead>
            <tr>
              <th>{t("Nội dung")}</th>
              <th style={{ width: 92 }}>{t("Đầy đủ/Đạt")}</th>
              <th>{t("Nội dung")}</th>
              <th style={{ width: 92 }}>{t("Đầy đủ/Đạt")}</th>
            </tr>
          </thead>
          <tbody>
            {COVER_CONTROL_GROUPS.map((group, groupIndex) => (
              <Fragment key={group.heading}>
                <tr className="pd-cover-grouprow">
                  <td colSpan={group.headingTick ? 1 : 4}>{t(group.heading)}</td>
                  {group.headingTick && (
                    <>
                      <td className="pd-cover-tick">{tick(`ctrl${groupIndex}_head`)}</td>
                      <td colSpan={2} />
                    </>
                  )}
                </tr>
                {group.pairs.map(([left, right], pairIndex) => (
                  <tr key={left}>
                    <td>{left && t(left)}</td>
                    <td className="pd-cover-tick">{tick(`ctrl${groupIndex}_${pairIndex}L`)}</td>
                    <td>{right && t(right)}</td>
                    <td className="pd-cover-tick">{tick(`ctrl${groupIndex}_${pairIndex}R`)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="pd-cover-grouprow">
              <td colSpan={2}>{t("Phân loại bệnh án")}</td>
              <td colSpan={2}>
                {t("Ngày nhận HSBA")}: {cell("receivedAt", "bd-a4-cellinput pd-cover-received")}
              </td>
            </tr>
            {COVER_OUTCOME_ROWS.map((row, index) => (
              <tr key={row}>
                <td>{t(row)}</td>
                <td className="pd-cover-tick">{tick(`outcome${index}`)}</td>
                <td colSpan={2}>{dateParts(`outcome${index}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pd-cover-signs">
          <div>
            <p className="pd-cover-signdate">{dateParts("handover")}</p>
            <p>
              <b>{t("Người giao hồ sơ")}</b>
            </p>
            <p>{t("(Ký, ghi rõ họ tên)")}</p>
          </div>
          <div>
            <p className="pd-cover-signdate">{dateParts("receipt")}</p>
            <p>
              <b>{t("Người nhận hồ sơ")}</b>
            </p>
            <p>{t("(Ký, ghi rõ họ tên)")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
