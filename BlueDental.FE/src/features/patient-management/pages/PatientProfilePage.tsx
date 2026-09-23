import { useMemo } from "react";
import { Spin } from "antd";
import { ArrowLeftOutlined, FileTextOutlined, UserOutlined } from "@ant-design/icons";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PageTabBar, type PageTab } from "@/components/PageTabBar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { usePatientDto } from "../api/patientQueries";
import { PatientDetailContent } from "../components/patient-detail/PatientDetailContent";
import { PatientMedicalRecordTab } from "../components/patient-detail/PatientMedicalRecordTab";
import "../components/patient-detail/patient-detail.css";
import "../components/patient-detail/image/patient-image.css";
import "../components/patient-detail/care/patient-care.css";

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
 * The record has two whole views, switched from the right of the tab row:
 * "Chi tiết hồ sơ" is the ten tabs, "Bệnh án" is the patient's own stack of
 * printed sheets. The reference keeps the tab row visible in both.
 */
type RecordView = "details" | "medical-record";

const RECORD_VIEW_KEYS = ["details", "medical-record"] as const;

const VIEW_I18N: Record<RecordView, string> = {
  details: "Patient:View:Details",
  "medical-record": "Patient:View:MedicalRecord",
};

const VIEW_ICON: Record<RecordView, React.ReactNode> = {
  details: <UserOutlined />,
  "medical-record": <FileTextOutlined />,
};

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
  const imageAbility = useAbility("treatmentImage");
  const medicalRecordAbility = useAbility("patientMedicalRecord");
  const consultationAbility = useAbility("treatmentConsultation");
  const diagnosisAbility = useAbility("treatmentDiagnosis");
  const stageAbility = useAbility("treatmentStage");
  const requestedTab = searchParams.get("tab");
  const view: RecordView = searchParams.get("view") === "medical-record" ? "medical-record" : "details";
  const listSearch = new URLSearchParams(searchParams);
  listSearch.delete("tab");
  listSearch.delete("view");

  /** The view rides in the URL, so a bệnh án can be linked to. */
  const openView = (next: RecordView) => {
    const params = new URLSearchParams(searchParams);
    if (next === "details") params.delete("view");
    else params.set("view", next);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
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

  const tabs: PageTab[] = visibleTabs.map((key) => {
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    if (key === defaultTab) next.delete("tab");
    else next.set("tab", key);
    const query = next.toString();
    return { key, label: t(TAB_I18N[key]), to: `${location.pathname}${query ? `?${query}` : ""}` };
  });

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
        <button
          type="button"
          onClick={() => navigate({ pathname: "/patient", search: listSearch.toString() })}
        >
          <ArrowLeftOutlined /> {t("Patient:Misc:GoBack")}
        </button>
        <span>/</span>
        <strong>
          [{patient.patientCode}] - {patient.fullName}
        </strong>
      </div>

      <div className="pd-tabrow">
        <PageTabBar tabs={tabs} activeKey={activeTab} label={t("Patient:Profile:Detail")} />
        {medicalRecordAbility.canRead && (
          <SegmentedTabs
            className="pd-viewswitch"
            items={RECORD_VIEW_KEYS.map((key) => ({
              key,
              label: (
                <>
                  {VIEW_ICON[key]}
                  {t(VIEW_I18N[key])}
                </>
              ),
            }))}
            activeKey={view}
            onChange={openView}
          />
        )}
      </div>

      {view === "medical-record" && medicalRecordAbility.canRead ? (
        <PatientMedicalRecordTab patientId={patient.id} patient={patient} />
      ) : (
        <PatientDetailContent activeTab={activeTab} patient={patient} />
      )}
    </div>
  );
}
