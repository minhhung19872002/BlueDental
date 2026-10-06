import { UserOutlined } from "@ant-design/icons";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { PrescriptionPatientSummary } from "../types/prescription";
import { ageOf } from "../utils/age";

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
    age === null ? null : t("Treatment:Rx:PatientAge", age),
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
        <p className="rx-patient-line">{t("Treatment:Rx:Gender", identity)}</p>
        <p className="rx-patient-line">{t("Treatment:Rx:MedicalHistory", history || t("Treatment:Prescription:NoData"))}</p>
        <p className="rx-patient-line">{t("Treatment:Rx:Contact", patient.phoneNumber || "—")}</p>
      </div>
    </div>
  );
}
