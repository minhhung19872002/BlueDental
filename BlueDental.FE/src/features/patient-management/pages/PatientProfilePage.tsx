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

const ALL_PATIENT_TABS = [
  ["profile", "Hồ sơ"],
  ["consulting", "Chẩn đoán & Tư vấn"],
  ["treatment-plan", "Kế hoạch điều trị"],
  ["appointment", "Lịch hẹn"],
  ["image", "Hình ảnh"],
  ["labo", "Labo"],
  ["prescription", "Đơn thuốc"],
  ["care", "Chăm sóc KH"],
  ["invoice", "Hóa đơn"],
  ["debt-history", "Lịch sử dư nợ"],
] as const;

type PatientTab = (typeof ALL_PATIENT_TABS)[number][0];

/**
 * The record has two whole views, switched from the right of the tab row:
 * "Chi tiết hồ sơ" is the ten tabs, "Bệnh án" is the patient's own stack of
 * printed sheets. The reference keeps the tab row visible in both.
 */
type RecordView = "details" | "medical-record";

const RECORD_VIEWS = [
  { key: "details" as const, label: "Chi tiết hồ sơ", icon: <UserOutlined /> },
  { key: "medical-record" as const, label: "Bệnh án", icon: <FileTextOutlined /> },
];

const isPatientTab = (value: string | null): value is PatientTab =>
  ALL_PATIENT_TABS.some(([key]) => key === value);

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
    // The debt ledger is the same GET as Hóa đơn — payment.read either way.
    if (!paymentAbility.canRead) hidden.add("debt-history");
    // The slip list is checked against treatmentConsultation.read directly.
    if (!consultationAbility.canRead) hidden.add("treatment-plan");
    // Chẩn đoán & Tư vấn reads through the legacy TreatmentPlans/Records
    // policies, which the bridge grants for ANY of the three treatment
    // subjects — so it only goes when the user can read none of them.
    if (!diagnosisAbility.canRead && !consultationAbility.canRead && !stageAbility.canRead) {
      hidden.add("consulting");
    }
    return ALL_PATIENT_TABS.filter(([key]) => !hidden.has(key));
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

  const activeTab: PatientTab =
    isPatientTab(requestedTab) && visibleTabs.some(([key]) => key === requestedTab)
      ? requestedTab
      : (visibleTabs[0]?.[0] as PatientTab) ?? "profile";

  const tabs: PageTab[] = visibleTabs.map(([key, label]) => {
    const next = new URLSearchParams(searchParams);
    // The open Đơn thuốc dialog rides in the URL; it does not follow to another tab.
    next.delete("create");
    if (key === "profile") next.delete("tab");
    else next.set("tab", key);
    const query = next.toString();
    return { key, label: t(label), to: `${location.pathname}${query ? `?${query}` : ""}` };
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
          title={t("Không tìm thấy hồ sơ bệnh nhân")}
          description={t("Hồ sơ này không tồn tại hoặc không thuộc chi nhánh đang xem.")}
          actionLabel={t("Về danh sách bệnh nhân")}
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
          <ArrowLeftOutlined /> {t("Quay lại")}
        </button>
        <span>/</span>
        <strong>
          [{patient.patientCode}] - {patient.fullName}
        </strong>
      </div>

      <div className="pd-tabrow">
        <PageTabBar tabs={tabs} activeKey={activeTab} label={t("Chi tiết bệnh nhân")} />
        {medicalRecordAbility.canRead && (
          <SegmentedTabs
            className="pd-viewswitch"
            items={RECORD_VIEWS.map((item) => ({
              key: item.key,
              label: (
                <>
                  {item.icon}
                  {t(item.label)}
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
