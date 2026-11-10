import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { printedDoctorName } from "@/utils/printedDoctorName";
import type { BranchInfo } from "@/hooks/useBranchInfo";
import { LABO_CASE_TYPE, laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { Fact } from "./LaboPrintSheet";
import { PrintCaseBoxes, PrintShadeTable, PrintToothChart } from "./LaboRequestSlipPrintParts";
import { dashed, longDate, type LaboDetailPatient } from "./laboOrderFacts";
import { laboFinishLinesText, laboWorkOf } from "./laboRequestSlipText";

interface Props {
  clinic: BranchInfo;
  patient: LaboDetailPatient;
  order: LaboOrderDto;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="pd-slip-print-field">
      <b>{label}:</b> <span>{children}</span>
    </p>
  );
}

/**
 * "PHIẾU YÊU CẦU LABO" — the A4 copy of a Phiếu yêu cầu order (F-91). The
 * mock has no print design, so it keeps the old sheet's letterhead and
 * print mechanism and lays the body out as the form reads: Loại phiếu and
 * dates, Loại phục hình, the Màu răng grid, the Chỉ định chart, Đường hoàn tất
 * and Yêu cầu. Set in the app's own font (owner, 2026-11-10); orders made on
 * the old form keep LaboPrintSheet.
 */
export function LaboRequestSlipSheet({ clinic, patient, order }: Props) {
  const tooth = order.teeth[0];
  const dentist = printedDoctorName(order.dentistName, order.dentistJobTitle) ?? "";
  const picked = new Set(order.teeth.map((item) => item.toothNumber));

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
          <h3>{t("Labo:Slip:Info")}</h3>
          <div className="pd-slip-print-line">
            <Field label={t("Labo:Slip:CaseType")}>
              <PrintCaseBoxes redo={order.caseType === LABO_CASE_TYPE.Redo} />
            </Field>
            <Field label={t("Labo:Slip:SentAt")}>{dashed(formatDate(order.sentAt))}</Field>
            <Field label={t("Labo:Slip:DueAt")}>{dashed(formatDate(order.dueAt))}</Field>
          </div>

          <h3>{t("Labo:Slip:Restoration")}</h3>
          <p className="pd-slip-print-text">{dashed(laboWorkOf(order) ?? "")}</p>

          <div className="pd-slip-print-pair">
            <section>
              <h3>{t("Labo:Slip:Shade")}</h3>
              <PrintShadeTable zones={tooth?.shadeZones} />
            </section>
            <section>
              <h3>{t("Labo:Slip:Teeth")}</h3>
              <PrintToothChart picked={picked} />
              <Field label={t("Patient:Payment:Quantity")}>{order.quantity}</Field>
            </section>
          </div>

          <h3>{t("Labo:Slip:FinishLine")}</h3>
          <p className="pd-slip-print-text">{dashed(laboFinishLinesText(order))}</p>

          <h3>{t("Labo:Slip:Request")}</h3>
          <p className="pd-slip-print-text pd-slip-print-notes">{dashed(order.notes ?? "")}</p>

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
