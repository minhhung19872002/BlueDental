import { useMemo } from "react";
import { Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PageTabBar, type PageTab } from "@/components/PageTabBar";
import { useAbility } from "@/hooks/useAbility";
import { readPatientOrigin } from "@/hooks/usePatientOrigin";
import { t } from "@/lib/i18n";
import { useInvoiceRequestStats } from "../api/invoiceRequestApi";
import { usePatientDto } from "../api/patientQueries";
import { PatientDetailContent } from "../components/patient-detail/PatientDetailContent";
import { PatientMedicalRecordTab } from "../components/patient-detail/PatientMedicalRecordTab";
import "../components/patient-detail/patient-detail.css";
import "../components/patient-detail/image/patient-image.css";
import "../components/patient-detail/care/patient-care.css";
// Lịch sử chăm sóc and its notes, shared with CSKH ▸ Hộp thư Zalo (F-80).
import "@/features/cskh/components/cskh-history.css";
import "@/features/cskh/components/cskh-notes.css";

const PATIENT_TAB_KEYS = [
  "profile",
  "consulting",
  "treatment-plan",
  "appointment",
  "image",
  "labo",
  "prescription",
  "care",
  "invoice",
  "debt-history",
] as const;

type PatientTab = (typeof PATIENT_TAB_KEYS)[number];

const TAB_I18N: Record<PatientTab, string> = {
  profile: "Patient:Tab:Profile",
  consulting: "Patient:Tab:Consulting",
  "treatment-plan": "Patient:Tab:TreatmentPlan",
  appointment: "Patient:Tab:Appointment",
  image: "Patient:Tab:Image",
  labo: "Patient:Tab:Labo",
  prescription: "Patient:Tab:Prescription",
  care: "Patient:Tab:Care",
  invoice: "Patient:Tab:Invoice",
  "debt-history": "Patient:Tab:DebtHistory",
};

/**
 * Bệnh án — the patient's own stack of printed sheets — is one more tab, kept
 * where the old "Chi tiết hồ sơ / Bệnh án" switch sat on the right of the row
 * (owner 2026-11-11, R-1204): any tab on the left leaves it, no way back
 * through "Chi tiết hồ sơ". `?view=medical-record`, its link before that,
 * still opens it.
 */
const MEDICAL_RECORD_TAB = "medical-record";

const isPatientTab = (value: string | null): value is PatientTab =>
  PATIENT_TAB_KEYS.includes(value as PatientTab);

export function PatientProfilePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const patientQuery = usePatientDto(id);
  const laboAbility = useAbility("treatmentLabo");
  const cskhAbility = useAbility("treatmentCskh");
  const appointmentAbility = useAbility("appointment");
  const prescriptionAbility = useAbility("prescription");
  const paymentAbility = useAbility("payment");
  // Open "Yêu cầu xuất HĐ" ride on the Hóa đơn tab as a badge.
  const invoiceRequestStats = useInvoiceRequestStats(id, paymentAbility.canRead);
  const imageAbility = useAbility("treatmentImage");
  const medicalRecordAbility = useAbility("patientMedicalRecord");
  const consultationAbility = useAbility("treatmentConsultation");
  const diagnosisAbility = useAbility("treatmentDiagnosis");
  const stageAbility = useAbility("treatmentStage");
  const requestedTab = searchParams.get("tab");
  const onMedicalRecord =
    medicalRecordAbility.canRead &&
    (requestedTab === MEDICAL_RECORD_TAB || searchParams.get("view") === MEDICAL_RECORD_TAB);
  const listSearch = new URLSearchParams(searchParams);
  listSearch.delete("tab");
  listSearch.delete("view");

  /** Back to wherever the record was opened from; the list when unknown. */
  const handleGoBack = () => {
    const origin = readPatientOrigin(id);
    if (origin) navigate(origin);
    else navigate({ pathname: "/patient", search: listSearch.toString() });
  };

  const visibleTabs = useMemo(() => {
    const hidden = new Set<string>();
    if (!laboAbility.canRead) hidden.add("labo");
    if (!cskhAbility.canRead) hidden.add("care");
    if (!appointmentAbility.canRead) hidden.add("appointment");
    if (!prescriptionAbility.canRead) hidden.add("prescription");
    if (!paymentAbility.canRead) hidden.add("invoice");
    if (!imageAbility.canRead) hidden.add("image");
    if (!paymentAbility.canRead) hidden.add("debt-history");
    if (!consultationAbility.canRead) hidden.add("treatment-plan");
    if (!diagnosisAbility.canRead && !consultationAbility.canRead && !stageAbility.canRead) {
      hidden.add("consulting");
    }
    return PATIENT_TAB_KEYS.filter((key) => !hidden.has(key));
  }, [
    laboAbility.canRead,
    cskhAbility.canRead,
    appointmentAbility.canRead,
    prescriptionAbility.canRead,
    paymentAbility.canRead,
    imageAbility.canRead,
    consultationAbility.canRead,
    diagnosisAbility.canRead,
    stageAbility.canRead,
  ]);

  const defaultTab: PatientTab =
    visibleTabs.includes("consulting") ? "consulting" : visibleTabs[0] ?? "profile";

  const activeTab: PatientTab =
    isPatientTab(requestedTab) && visibleTabs.includes(requestedTab)
      ? requestedTab
      : defaultTab;

  /** A tab's link: the default tab drops `tab`, and every tab drops the old `view`. */
  const tabLink = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    next.delete("view");
    if (key === defaultTab) next.delete("tab");
    else next.set("tab", key);
    const query = next.toString();
    return `${location.pathname}${query ? `?${query}` : ""}`;
  };

  const tabs: PageTab[] = visibleTabs.map((key) => {
    const badge = key === "invoice" ? invoiceRequestStats.data?.open : undefined;
    return { key, label: t(TAB_I18N[key]), to: tabLink(key), badge };
  });
  const medicalRecordTabs: PageTab[] = [
    { key: MEDICAL_RECORD_TAB, label: t("Patient:View:MedicalRecord"), to: tabLink(MEDICAL_RECORD_TAB) },
  ];
  const shownTab = onMedicalRecord ? MEDICAL_RECORD_TAB : activeTab;

  if (patientQuery.isLoading) {
    return (
      <div className="pd-loading">
        <Spin size="large" />
      </div>
    );
  }

  const patient = patientQuery.data;
  if (!patient) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🔍"
          title={t("Patient:Profile:NotFoundShort")}
          description={t("Patient:Profile:NotFound")}
          actionLabel={t("Patient:Profile:BackToList")}
          onAction={() => navigate("/patient")}
        />
      </div>
    );
  }

  return (
    <div className="page-container pd-page">
      <div className="pd-breadcrumb">
        <button type="button" onClick={handleGoBack}>
          <ArrowLeftOutlined /> {t("Patient:Misc:GoBack")}
        </button>
        <span>/</span>
        <strong>
          [{patient.patientCode}] - {patient.fullName}
        </strong>
      </div>

      <div className="pd-tabrow">
        <PageTabBar tabs={tabs} activeKey={shownTab} label={t("Patient:Profile:Detail")} />
        {medicalRecordAbility.canRead && (
          <PageTabBar
            className="pd-recordtab"
            tabs={medicalRecordTabs}
            activeKey={shownTab}
            label={t("Patient:View:MedicalRecord")}
          />
        )}
      </div>

      {onMedicalRecord ? (
        <PatientMedicalRecordTab patientId={patient.id} patient={patient} />
      ) : (
        <PatientDetailContent activeTab={activeTab} patient={patient} />
      )}
    </div>
  );
}
