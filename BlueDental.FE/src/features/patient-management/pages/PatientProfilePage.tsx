import { useParams, useNavigate } from "react-router-dom";
import { Button, Spin, Tabs, Tag } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { usePatient } from "../api/patientQueries";
import { DentalChartView } from "../components/DentalChartView";
import { AllergyList } from "../components/AllergyList";
import { MedicalHistoryPanel } from "../components/MedicalHistoryPanel";
import { formatDate } from "@/utils/format";
import { brand } from "@/theme/index";

const GENDER_LABELS = { male: "Nam", female: "Nữ", other: "Khác" };

export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient, isLoading } = usePatient(id ?? "");

  if (isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/patient")}
            style={{ marginBottom: 8 }}
          >
            Quay lại danh sách
          </Button>
          <h1 className="page-header-title">{patient.fullName}</h1>
          <p className="page-header-subtitle">
            {patient.code} &middot; {patient.age} tuổi &middot;{" "}
            {GENDER_LABELS[patient.gender]} &middot; {patient.phone}
          </p>
        </div>
      </div>

      <Tabs
        items={[
          {
            key: "chart",
            label: "Biểu đồ răng",
            children: (
              <div className="page-card">
                <DentalChartView />
              </div>
            ),
          },
          {
            key: "history",
            label: "Tiền sử bệnh",
            children: (
              <div className="page-card">
                <MedicalHistoryPanel history={patient.medicalHistory} />
              </div>
            ),
          },
          {
            key: "allergies",
            label: (
              <span>
                Dị ứng{" "}
                {patient.allergies.length > 0 && (
                  <Tag color="red" style={{ marginInlineStart: 4 }}>
                    {patient.allergies.length}
                  </Tag>
                )}
              </span>
            ),
            children: (
              <div className="page-card">
                <AllergyList allergies={patient.allergies} />
              </div>
            ),
          },
          {
            key: "info",
            label: "Thông tin cá nhân",
            children: (
              <div className="page-card">
                <table style={{ borderSpacing: "0 8px", fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td style={{ color: brand.muted, paddingRight: 24 }}>
                        Ngày sinh
                      </td>
                      <td>{formatDate(patient.dateOfBirth)}</td>
                    </tr>
                    <tr>
                      <td style={{ color: brand.muted, paddingRight: 24 }}>
                        Email
                      </td>
                      <td>{patient.email ?? "—"}</td>
                    </tr>
                    <tr>
                      <td style={{ color: brand.muted, paddingRight: 24 }}>
                        Địa chỉ
                      </td>
                      <td>{patient.address ?? "—"}</td>
                    </tr>
                    <tr>
                      <td style={{ color: brand.muted, paddingRight: 24 }}>
                        Lần khám cuối
                      </td>
                      <td>
                        {patient.lastVisitAt
                          ? formatDate(patient.lastVisitAt)
                          : "Chưa có"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
