import { UserOutlined } from "@ant-design/icons";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { PrescriptionPatientSummary } from "../types/prescription";

function ageOf(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * The head of the "Thêm đơn thuốc" dialog: avatar, the patient's name, then
 * "Giới tính: Nữ - 15/02/2000 - 26 tuổi", "Tiểu sử bệnh: …", "Liên hệ: …" —
 * one line each, exactly as the reference states them.
 */
export function PrescriptionPatientBlock({ patient }: { patient: PrescriptionPatientSummary }) {
  const diseases = useCatalogOptions(CATALOG_GROUP.DiseaseHistory).data ?? [];
  const history = diseases
    .filter((entry) => patient.diseaseHistoryEntryIds.includes(entry.id))
    .map((entry) => entry.name)
    .join(", ");
  const age = ageOf(patient.dateOfBirth);

  const identity = [
    patient.genderLabel,
    patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null,
    age === null ? null : t("{0} tuổi", age),
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="rx-patient">
      <div className="rx-patient-avatar" aria-hidden="true">
        <UserOutlined />
      </div>
      <div className="bd-min0">
        <h3 className="rx-patient-name">{patient.fullName}</h3>
        <p className="rx-patient-line">{t("Giới tính: {0}", identity)}</p>
        <p className="rx-patient-line">{t("Tiểu sử bệnh: {0}", history || t("Chưa có dữ liệu"))}</p>
        <p className="rx-patient-line">{t("Liên hệ: {0}", patient.phoneNumber || "—")}</p>
      </div>
    </div>
  );
}
