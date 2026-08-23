import { Drawer, Descriptions, Tag, Spin, Avatar } from "antd";
import { useTranslation } from "react-i18next";
import { usePatient } from "../api/patientQueries";
import { DentalChartView } from "./DentalChartView";
import { formatDate } from "@/utils/format";
import { brand } from "@/theme/index";

interface Props {
  patientId: string | null;
  onClose: () => void;
}

export function PatientDetailDrawer({ patientId, onClose }: Props) {
  const { t } = useTranslation();
  const GENDER_LABELS: Record<string, string> = {
    male: t("patient.genderMale"),
    female: t("patient.genderFemale"),
    other: t("patient.genderOther"),
  };
  const { data: patient, isLoading } = usePatient(patientId ?? "");

  return (
    <Drawer
      open={Boolean(patientId)}
      onClose={onClose}
      title={patient ? `${t("patient.profile")}: ${patient.fullName}` : t("patient.profileTitle")}
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
                {t("patient.code")}: {patient.code} &middot; {patient.age} {t("patient.yearsOld")}
              </div>
            </div>
          </div>

          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label={t("patient.dateOfBirth")}>
              {formatDate(patient.dateOfBirth)}
            </Descriptions.Item>
            <Descriptions.Item label={t("patient.gender")}>
              {GENDER_LABELS[patient.gender]}
            </Descriptions.Item>
            <Descriptions.Item label={t("common.phone")}>
              {patient.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {patient.email ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("patient.address")} span={2}>
              {patient.address ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("patient.medicalHistory")} span={2}>
              {patient.medicalHistory ?? t("common.none")}
            </Descriptions.Item>
            <Descriptions.Item label={t("patient.allergies")} span={2}>
              {patient.allergies.length > 0
                ? patient.allergies.map((a) => (
                    <Tag key={a} color="red">
                      {a}
                    </Tag>
                  ))
                : t("common.none")}
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
              {t("patient.dentalChart")}
            </div>
            <DentalChartView readOnly />
          </div>
        </div>
      )}
    </Drawer>
  );
}
