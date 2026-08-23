import { Drawer, Descriptions, Tag, Spin, Avatar } from "antd";
import { usePatient } from "../api/patientQueries";
import { DentalChartView } from "./DentalChartView";
import { formatDate } from "@/utils/format";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

const genderLabelsOf = () => ({ male: t("Nam"), female: t("Nữ"), other: t("Khác") });

interface Props {
  patientId: string | null;
  onClose: () => void;
}

export function PatientDetailDrawer({ patientId, onClose }: Props) {
  const { data: patient, isLoading } = usePatient(patientId ?? "");

  return (
    <Drawer
      open={Boolean(patientId)}
      onClose={onClose}
      title={patient ? t("Hồ sơ: {0}", patient.fullName) : t("Hồ sơ bệnh nhân")}
      width={640}
    >
      {isLoading && (
        <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <Spin />
        </div>
      )}

      {patient && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Avatar
              size={56}
              style={{
                backgroundColor: brand.blue,
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              {patient.initials}
            </Avatar>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: brand.ink }}>
                {patient.fullName}
              </div>
              <div style={{ fontSize: 13, color: brand.muted }}>
                {t("Mã:")} {patient.code} &middot; {patient.age} {t("tuổi")}
              </div>
            </div>
          </div>

          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label={t("Ngày sinh")}>
              {formatDate(patient.dateOfBirth)}
            </Descriptions.Item>
            <Descriptions.Item label={t("Giới tính")}>
              {genderLabelsOf()[patient.gender]}
            </Descriptions.Item>
            <Descriptions.Item label={t("Điện thoại")}>
              {patient.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {patient.email ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Địa chỉ")} span={2}>
              {patient.address ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Tiền sử bệnh")} span={2}>
              {patient.medicalHistory ?? t("Không có")}
            </Descriptions.Item>
            <Descriptions.Item label={t("Dị ứng")} span={2}>
              {patient.allergies.length > 0
                ? patient.allergies.map((a) => (
                    <Tag key={a} color="red">
                      {a}
                    </Tag>
                  ))
                : t("Không có")}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: brand.ink,
                marginBottom: 12,
              }}
            >
              {t("Biểu đồ răng")}
            </div>
            <DentalChartView readOnly />
          </div>
        </div>
      )}
    </Drawer>
  );
}
