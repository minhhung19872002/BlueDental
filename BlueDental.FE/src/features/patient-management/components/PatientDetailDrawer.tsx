import { Drawer, Descriptions, Tag, Spin, Avatar } from "antd";
import { usePatient } from "../api/patientQueries";
import { DentalChartView } from "./DentalChartView";
import { formatDate } from "@/utils/format";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

interface Props {
  patientId: string | null;
  onClose: () => void;
}

export function PatientDetailDrawer({ patientId, onClose }: Props) {
  const GENDER_LABELS: Record<string, string> = {
    male: t("Nam"),
    female: t("Patient:Misc:Female"),
    other: t("Patient:Misc:OtherLabel"),
  };
  const { data: patient, isLoading } = usePatient(patientId ?? "");

  return (
    <Drawer
      open={Boolean(patientId)}
      onClose={onClose}
      title={patient ? `${t("Patient:Profile:RecordLabel")}: ${patient.fullName}` : t("Patient:Profile:Title")}
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
                {t("Patient:Misc:CodeLabel")}: {patient.code} &middot; {patient.age} {t("Patient:Misc:Age")}
              </div>
            </div>
          </div>

          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label={t("Patient:Col:DateOfBirth")}>
              {formatDate(patient.dateOfBirth)}
            </Descriptions.Item>
            <Descriptions.Item label={t("Patient:Col:Gender")}>
              {GENDER_LABELS[patient.gender]}
            </Descriptions.Item>
            <Descriptions.Item label={t("Patient:Col:Phone")}>
              {patient.phone}
            </Descriptions.Item>
            <Descriptions.Item label={t("Email")}>
              {patient.email ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Patient:Col:Address")} span={2}>
              {patient.address ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Patient:Tab:MedicalHistory")} span={2}>
              {patient.medicalHistory ?? t("Patient:Misc:None")}
            </Descriptions.Item>
            <Descriptions.Item label={t("Patient:Allergy:Title")} span={2}>
              {patient.allergies.length > 0
                ? patient.allergies.map((a) => (
                    <Tag key={a} color="red">
                      {a}
                    </Tag>
                  ))
                : t("Patient:Misc:None")}
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
              {t("Patient:DentalChart:Title")}
            </div>
            <DentalChartView readOnly />
          </div>
        </div>
      )}
    </Drawer>
  );
}
