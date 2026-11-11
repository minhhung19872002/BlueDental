import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { printedDoctorName } from "@/utils/printedDoctorName";
import type { BranchInfo } from "@/hooks/useBranchInfo";
import { laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { Fact } from "./LaboPrintSheet";
import { LaboRequestSlipPrintBody } from "./LaboRequestSlipPrintBody";
import { longDate, type LaboDetailPatient } from "./laboOrderFacts";

interface Props {
  clinic: BranchInfo;
  patient: LaboDetailPatient;
  order: LaboOrderDto;
}

/**
 * "PHIẾU YÊU CẦU LABO" — the A4 copy of a Phiếu yêu cầu order (F-91). The
 * mock has no print design, so it keeps the old sheet's letterhead and
 * print mechanism and lays the body out as the form reads: Loại phiếu and
 * dates, Loại phục hình, the Màu răng grid, the Chỉ định chart, Đường hoàn tất
 * and Yêu cầu. Set in the app's own font (owner, 2026-11-10); orders made on
 * the old form keep LaboPrintSheet. An order holding a Mẫu phiếu's layout
 * prints its blocks instead (F-94).
 */
export function LaboRequestSlipSheet({ clinic, patient, order }: Props) {
  const dentist = printedDoctorName(order.dentistName, order.dentistJobTitle) ?? "";

  return createPortal(
    <div className="pd-print-sheet">
      <article className="pd-labo-sheet pd-slip-print">
        <div className="pd-print-sheethead">
          <section>
            <Fact label={t("Patient:Misc:Clinic")} value={clinic.name} />
            <Fact label={t("Patient:Col:Address")} value={clinic.address ?? ""} />
            <Fact label={t("Patient:Form:Tel")} value={clinic.phone ?? ""} />
            <Fact label={t("Email")} value={clinic.email ?? ""} />
          </section>
          <header>
            <h2>{t("Labo:Slip:PrintTitle")}</h2>
            <p>{longDate(new Date())}</p>
            <p>
              {t("Labo:Slip:SlipNo")}: {laboOrderNo(order)}
            </p>
          </header>
          <section>
            <Fact label={t("Patient:Col:PatientCode")} value={patient.code} />
            <Fact label={t("Patient:Col:Customer")} value={patient.name} />
            <Fact label={t("Patient:Col:DateOfBirth")} value={formatDate(patient.dateOfBirth)} />
            <Fact label={t("Patient:QuoteSheet:PrescribingDoctor")} value={dentist} />
          </section>
        </div>

        <div className="pd-labo-sheet-body">
          <LaboRequestSlipPrintBody order={order} />

          <div className="pd-labo-sheet-sign">
            <div>
              <p>{t("Patient:Labo:Orderer")}</p>
              <p>{t("Patient:QuoteSheet:SignConfirm")}</p>
              <p>{dentist}</p>
            </div>
          </div>
        </div>
      </article>
    </div>,
    document.body,
  );
}
