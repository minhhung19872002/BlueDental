import { Alert } from "antd";
import { t } from "@/lib/i18n";
import type { AllergyConflict } from "../utils/allergyConflicts";

function describe(conflict: AllergyConflict): string {
  const medicine = conflict.groupName
    ? t("Treatment:Rx:AllergyMedicineInGroup", conflict.medicineName, conflict.groupName)
    : conflict.medicineName;
  return t("Treatment:Rx:AllergyLine", medicine, conflict.allergyNames.join(", "));
}

/**
 * The warning over the medicine lines while the slip holds a medicine the
 * patient declared an allergy to. It warns, it does not block: the doctor
 * confirms on Lưu.
 */
export function PrescriptionAllergyAlert({ conflicts }: { conflicts: AllergyConflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      className="rx-allergy-alert"
      title={t("Treatment:Rx:AllergyTitle")}
      description={
        <ul className="rx-allergy-list">
          {conflicts.map((conflict) => (
            <li key={conflict.medicineId}>{describe(conflict)}</li>
          ))}
        </ul>
      }
    />
  );
}
