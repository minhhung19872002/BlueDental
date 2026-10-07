import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { GUARDIAN_LIMITS } from "../../types/patient";
import type { GuardianGroup } from "../../utils/guardian";
import { GuardianCard } from "./GuardianCard";

interface Props {
  group: GuardianGroup;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

/** The "Người giám hộ" pill's pane: a card per guardian and the dashed add button. */
export function GuardianPane({ group, onAdd, onEdit, onDelete }: Props) {
  const full = group.guardians.length >= GUARDIAN_LIMITS.maxPerPatient;

  return (
    <div className="bd-guardian-pane">
      {group.guardians.length === 0 && <p className="bd-guardian-empty">{t("Patient:Guardian:Empty")}</p>}

      {group.guardians.map((guardian, index) => (
        <GuardianCard
          key={guardian.uid}
          guardian={guardian}
          consented={group.consented}
          onEdit={() => onEdit(index)}
          onDelete={() => onDelete(index)}
        />
      ))}

      <Button type="dashed" block icon={<PlusOutlined />} disabled={full} onClick={onAdd}>
        {t("Patient:Guardian:Add")}
      </Button>
    </div>
  );
}
