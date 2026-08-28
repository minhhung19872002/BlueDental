import { Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PageTabBar, type PageTab } from "@/components/PageTabBar";
import { t } from "@/lib/i18n";
import { usePatientDto } from "../api/patientQueries";
import { PatientDetailContent } from "../components/patient-detail/PatientDetailContent";
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
  const listSearch = new URLSearchParams(searchParams);
  listSearch.delete("tab");

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

      <PageTabBar tabs={tabs} activeKey={activeTab} label={t("Chi tiết bệnh nhân")} />

      <PatientDetailContent activeTab={activeTab} patient={patient} />
    </div>
  );
}
