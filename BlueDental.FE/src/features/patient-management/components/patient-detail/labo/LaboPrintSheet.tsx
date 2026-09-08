import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import type { PrintClinic } from "../stage/TreatmentHistoryPrintDialog";
import { dashed, type LaboDetailPatient, type LaboOrderFacts } from "./laboOrderFacts";

interface Props {
  clinic: PrintClinic;
  patient: LaboDetailPatient;
  orderCode: string;
  facts: LaboOrderFacts;
}

/** "Ngày 8 tháng 9 năm 2026", the wording under the sheet's title. */
function longDate(value: Date): string {
  return t(
    "Ngày {0} tháng {1} năm {2}",
    value.getDate(),
    value.getMonth() + 1,
    value.getFullYear(),
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="pd-labo-sheet-row">
      <b>{label}:</b> <span>{dashed(value)}</span>
    </p>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span>{label}:</span> <span>{dashed(value)}</span>
    </p>
  );
}

/**
 * "PHIẾU ĐẶT HÀNG LABO" — the A4 copy behind "In Phiếu Labo". Off-screen until
 * the body wears `pd-printing`, and portaled onto <body> rather than kept
 * inside the modal, for the reason TreatmentHistoryPrintDialog gives. Layout
 * measured on the reference on 2026-09-08 (docs/clone/pages/patient-detail.md).
 */
export function LaboPrintSheet({ clinic, patient, orderCode, facts }: Props) {
  return createPortal(
    <div className="pd-print-sheet">
      <article className="pd-labo-sheet">
        <div className="pd-print-sheethead">
          <section>
            <Fact label={t("Phòng khám")} value={clinic.name} />
            <Fact label={t("Địa chỉ")} value={clinic.address ?? ""} />
            <Fact label={t("ĐT")} value={clinic.phone ?? ""} />
            <Fact label={t("Email")} value={clinic.email ?? ""} />
          </section>
          <header>
            <h2>{t("PHIẾU ĐẶT HÀNG LABO")}</h2>
            <p>{longDate(new Date())}</p>
            <p>
              {t("Số")}: {orderCode}
            </p>
          </header>
          <section>
            <Fact label={t("Mã KH")} value={patient.code} />
            <Fact label={t("Khách hàng")} value={patient.name} />
            <Fact label={t("Ngày sinh")} value={facts.birthDate} />
            <Fact label={t("Bác sĩ chỉ định")} value={facts.dentist} />
          </section>
        </div>

        <div className="pd-labo-sheet-body">
          <div className="pd-labo-sheet-grid">
            <section>
              <h3>{t("Thông tin đơn hàng")}</h3>
              <Row label={t("Nhà cung cấp")} value={facts.supplier} />
              <Row label={t("Ngày gửi")} value={facts.sentAt} />
              <Row label={t("Ngày nhận dự kiến")} value={facts.dueDate} />
            </section>
            <section>
              <h3>{t("Thông số chung")}</h3>
              <Row label={t("Lựa chọn dịch vụ")} value={facts.laboService} />
              <Row label={t("Dịch vụ điều trị")} value={facts.treatmentService} />
              <Row label={t("Loại phục hình")} value={facts.laboService} />
            </section>
          </div>

          <h3>{t("Chi tiết phục hình")}</h3>
          <div className="pd-labo-sheet-grid">
            <section>
              <Row label={t("Vật liệu")} value={facts.material} />
              <Row label={t("Đường hoàn tất")} value={facts.finishLine} />
              <Row label={t("Khớp cắn")} value={facts.bite} />
              <Row label={t("Kiểu nhịp")} value={facts.rhythm} />
            </section>
            <section>
              <Row label={t("Số răng")} value={facts.teeth} />
              <Row label={t("Màu sắc chi tiết")} value={facts.shade} />
              <Row label={t("Số lượng")} value={facts.quantity} />
              <Row label={t("Nội dung chỉ định")} value={facts.instruction} />
            </section>
          </div>

          <div className="pd-labo-sheet-sign">
            <div>
              <p>{t("Người đặt hàng")}</p>
              <p>{t("(Ký xác nhận)")}</p>
              <p>{facts.dentist}</p>
            </div>
          </div>
        </div>
      </article>
    </div>,
    document.body,
  );
}
