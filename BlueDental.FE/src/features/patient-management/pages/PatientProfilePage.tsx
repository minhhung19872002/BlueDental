import { Spin } from "antd";
import { ArrowLeftOutlined, FileTextOutlined, UserOutlined } from "@ant-design/icons";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PageTabBar, type PageTab } from "@/components/PageTabBar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import { usePatientDto } from "../api/patientQueries";
import { PatientDetailContent } from "../components/patient-detail/PatientDetailContent";
import { PatientMedicalRecordTab } from "../components/patient-detail/PatientMedicalRecordTab";
import "../components/patient-detail/patient-detail.css";

const PATIENT_TABS = [
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

type PatientTab = (typeof PATIENT_TABS)[number][0];

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
  PATIENT_TABS.some(([key]) => key === value);

export function PatientProfilePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const patientQuery = usePatientDto(id);
  const requestedTab = searchParams.get("tab");
  const activeTab: PatientTab = isPatientTab(requestedTab) ? requestedTab : "profile";
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

  const tabs: PageTab[] = PATIENT_TABS.map(([key, label]) => {
    const next = new URLSearchParams(searchParams);
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
      </div>

      {view === "medical-record" ? (
        <PatientMedicalRecordTab patientId={patient.id} patient={patient} />
      ) : (
        <PatientDetailContent activeTab={activeTab} patient={patient} />
      )}
    </div>
  );
}
