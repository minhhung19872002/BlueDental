import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { DiagnosisGroupBlock } from "./DiagnosisGroupBlock";
import {
  groupByDiagnosis,
  lineTotal,
  money,
  romanNumeral,
  rowDiscount,
  type QuoteClinic,
  type QuoteCustomer,
  type QuoteImage,
  type QuoteRow,
  type QuoteTotals,
} from "./quoteModel";
import { QuoteSignatures } from "./QuoteSignatures";

export interface DiagnosisInvoiceSheetProps {
  clinic: QuoteClinic;
  customer: QuoteCustomer;
  rows: QuoteRow[];
  totals: QuoteTotals;
  images: QuoteImage[];
}

const dash = (value: string) => value || "-";

/**
 * "PHIẾU CHẨN ĐOÁN & HÓA ĐƠN" — the sheet "In hóa đơn kèm chẩn đoán" prints:
 * the ticked images, one section per diagnosis with its doctors' write-ups,
 * then the quoted services, and the reference's signature strip — "Bác sĩ
 * chẩn đoán" and "Khách hàng", the name printed above "(Ký, họ tên)". An
 * earlier pass recorded that it printed none, which the owner's copy corrected.
 * Explanations edited here stay here for the life of the preview.
 */
export function DiagnosisInvoiceSheet({
  clinic,
  customer,
  rows,
  totals,
  images,
}: DiagnosisInvoiceSheetProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const groups = useMemo(
    () =>
      groupByDiagnosis(rows).map((group) => ({
        ...group,
        doctors: group.doctors.map((item) => ({
          ...item,
          explanationHtml: edits[item.key] ?? item.explanationHtml,
        })),
      })),
    [rows, edits],
  );
  const firstNumber = images.length > 0 ? 2 : 1;

  // The sheet is signed by the doctor who made the diagnosis. Several rows can
  // name the same doctor, and a slip occasionally names two, so the distinct
  // names are joined rather than the first one taken.
  const diagnosingDoctor = useMemo(
    () => [...new Set(rows.flatMap((row) => row.doctors).filter(Boolean))].join(", "),
    [rows],
  );

  // Typed over, the edit stands for the life of the preview. Held as "not yet
  // edited" rather than seeded through an effect: an effect keyed on the rows
  // would wipe what the user typed the moment anything above re-rendered.
  const [signedBy, setSignedBy] = useState<string | null>(null);

  return (
    <div className="pq-dx">
      <div className="pq-dx__header">
        <div className="pq-dx__branch">
          {clinic.logoUrl && <img className="pq-dx__logo" src={clinic.logoUrl} alt="" />}
          <div>
            <p>
              <strong>{t("PHÒNG KHÁM")}:</strong> {dash(clinic.name)}
            </p>
            <p>{t("Địa chỉ: {0}", dash(clinic.address))}</p>
            <p>{t("ĐT: {0}", dash(clinic.phone))}</p>
          </div>
        </div>
        <div className="pq-dx__title">
          <h1>{t("PHIẾU CHẨN ĐOÁN & HÓA ĐƠN")}</h1>
          <p>{t("PHÒNG KHÁM NHA KHOA")}</p>
          <p className="pq-dx__date">{t("Ngày: {0}", formatDate(new Date()))}</p>
        </div>
        <div className="pq-dx__customer">
          <p>{t("Mã KH: {0}", dash(customer.code))}</p>
          <p>{t("Họ tên: {0}", dash(customer.name))}</p>
          <p>{t("Ngày sinh: {0}", customer.dateOfBirth)}</p>
          <p>{t("SĐT: {0}", dash(customer.phone))}</p>
        </div>
      </div>

      {images.length > 0 && (
        <section>
          <div className="pq-dx__section">
            <h2>I. {t("HÌNH ẢNH CHẨN ĐOÁN")}</h2>
          </div>
          <div className="pq-dx__image-grid">
            {images.map((image) => (
              <div key={image.id} className="pq-dx__image-frame">
                <img src={image.src} alt={image.alt} />
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.map((group, index) => (
        <DiagnosisGroupBlock
          key={group.name}
          numeral={romanNumeral(firstNumber + index)}
          group={group}
          customerName={customer.name}
          onChangeExplanation={(key, html) => setEdits((prev) => ({ ...prev, [key]: html }))}
        />
      ))}

      <section className="pq-dx__services">
        <p className="pq-dx__services-title">{t("DANH SÁCH DỊCH VỤ BÁO GIÁ")}</p>
        <table className="pq-dx__table">
          <thead>
            <tr>
              <th>{t("Dịch vụ")}</th>
              <th>{t("Chẩn đoán")}</th>
              <th>{t("Đơn giá")}</th>
              <th>{t("Giảm giá")}</th>
              <th>{t("Thành tiền")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.service}</td>
                <td className="pq-sheet__diagnosis">
                  {[row.teeth, row.diagnosis || "-"].filter(Boolean).join(" - ")}
                </td>
                <td>{t("{0} (SL. {1})", money(row.unitPrice), row.quantity)}</td>
                <td>{money(rowDiscount(row))}</td>
                <td>{money(lineTotal(row))}</td>
              </tr>
            ))}
            <SummaryRows totals={totals} />
          </tbody>
        </table>
      </section>

      <QuoteSignatures
        layout="name-first"
        caption={t("(Ký, họ tên)")}
        leftLabel={t("Bác sĩ chẩn đoán")}
        leftName={signedBy ?? diagnosingDoctor}
        onLeftNameChange={setSignedBy}
        rightLabel={t("Khách hàng")}
        rightName={dash(customer.name)}
      />
    </div>
  );
}

function SummaryRows({ totals }: { totals: QuoteTotals }) {
  const span = totals.extra > 0 ? 4 : 3;
  return (
    <>
      <tr>
        <td colSpan={3} rowSpan={span} className="pq-sheet__summary-empty" />
        <td className="pq-sheet__summary-label">{t("TỔNG TIỀN:")}</td>
        <td className="pq-sheet__summary-value">{money(totals.gross)}</td>
      </tr>
      <tr>
        <td className="pq-sheet__summary-label">{t("GIẢM GIÁ:")}</td>
        <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
          {totals.discount > 0 ? `-${money(totals.discount)}` : money(0)}
        </td>
      </tr>
      {totals.extra > 0 && (
        <tr>
          <td className="pq-sheet__summary-label">{t("GIẢM GIÁ BÁC SĨ:")}</td>
          <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
            -{money(totals.extra)}
          </td>
        </tr>
      )}
      <tr className="pq-sheet__summary-row--total">
        <td className="pq-sheet__summary-label pq-sheet__summary-label--total">
          {t("THÀNH TIỀN:")}
        </td>
        <td className="pq-sheet__summary-value pq-sheet__summary-value--total">
          {money(totals.net)}
        </td>
      </tr>
    </>
  );
}
