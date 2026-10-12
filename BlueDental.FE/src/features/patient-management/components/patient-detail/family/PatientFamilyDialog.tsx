import { Modal } from "antd";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import type { PatientDto } from "../../../types/patient";
import { FamilyGroupsStrip } from "./FamilyGroupsStrip";
import { FamilyPeopleSection, type GuardianCardsControl } from "./FamilyPeopleSection";
import "./family.css";

interface Props {
  open: boolean;
  /** Null while the record is being created — it has no relations or groups yet. */
  patient: PatientDto | null;
  /** Display name from the editor — what is typed now, not what was last saved. */
  patientName: string;
  guardians: GuardianCardsControl;
  onClose: () => void;
}

/**
 * "Gia đình & Quan hệ", opened from the hồ sơ editor's third pill. One story
 * (owner, 2026-10-12): the family group on top, then everyone tied to the
 * record in one list — a guardian picked from a hồ sơ is that person's
 * relation too, and a family group's members are related to its Chủ hộ.
 * Guardians stay staged in the editor; relations are written at once.
 */
export function PatientFamilyDialog({ open, patient, patientName, guardians, onClose }: Props) {
  const { canUpdate } = useAbility("patient");
  const name = patientName.trim();

  return (
    <Modal
      open={open}
      title={
        <h2 className="bd-modal-title">
          {name ? t("Patient:Family:DialogTitle", name) : t("Patient:Tab:Family")}
        </h2>
      }
      onCancel={onClose}
      width={patient ? 780 : 600}
      destroyOnHidden
      footer={null}
      className="app-dialog pf-dialog"
    >
      <div className="pf-content">
        {patient ? <FamilyGroupsStrip patientId={patient.id} /> : null}
        <div className="pf-card">
          <FamilyPeopleSection patient={patient} guardians={guardians} canEdit={canUpdate} />
        </div>
      </div>
    </Modal>
  );
}
