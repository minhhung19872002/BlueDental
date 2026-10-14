import { useState } from "react";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { PrescriptionPanel } from "@/features/treatment-management/components/PrescriptionPanel";
import type { PrescriptionPatientSummary } from "@/features/treatment-management/types/prescription";
import { t } from "@/lib/i18n";
import { GENDER, type GenderCode, type PatientDto } from "../../types/patient";
import { InvoiceRequestPanel } from "./invoice-request/InvoiceRequestPanel";
import { PatientReceiptTable } from "./PatientReceiptTable";

const GENDER_LABELS: Record<GenderCode, string> = {
  [GENDER.Male]: "Common:Gender:Male",
  [GENDER.Female]: "Common:Gender:Female",
  [GENDER.Other]: "Common:Gender:Other",
  [GENDER.PreferNotToSay]: "Common:Gender:PreferNotToSay",
};

export function PatientPrescriptionTab({ patient }: { patient: PatientDto }) {
  const summary: PrescriptionPatientSummary = {
    id: patient.id,
    code: patient.patientCode,
    fullName: patient.fullName,
    genderLabel: t(GENDER_LABELS[patient.gender]),
    dateOfBirth: patient.dateOfBirth,
    phoneNumber: patient.phoneNumber,
    diseaseHistoryEntryIds: patient.diseaseHistoryEntryIds,
  };
  return (
    <section className="pd-pane pd-pane--fill">
      <PrescriptionPanel patient={summary} />
    </section>
  );
}

type InvoiceSubTab = "requests" | "receipts";

/**
 * Tab Hóa đơn: the customers' "Yêu cầu xuất HĐ" first (the BA mockup), the
 * payment table it used to be behind the second segment.
 */
export function PatientInvoiceTab({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<InvoiceSubTab>("requests");
  return (
    <section className="pd-pane pd-pane--fill">
      <SegmentedTabs<InvoiceSubTab>
        items={[
          { key: "requests", label: t("Patient:InvoiceRequest:Tab:Requests") },
          { key: "receipts", label: t("Patient:InvoiceRequest:Tab:Receipts") },
        ]}
        activeKey={tab}
        onChange={setTab}
        className="pd-invoice-tabs"
      />
      {tab === "requests" ? <InvoiceRequestPanel patientId={patientId} /> : <PatientReceiptTable patientId={patientId} />}
    </section>
  );
}
