import { Tag } from "antd";
import { SearchSelect } from "@/components/SearchSelect";
import { usePatientPicker } from "@/hooks/usePatientOptions";
import { t } from "@/lib/i18n";

export interface MemberChoice {
  patientId: string;
  label: string;
}

interface Props {
  value?: MemberChoice[];
  onChange?: (value: MemberChoice[]) => void;
  /** The card's owner, who is never a member of their own card. */
  ownerId?: string;
  max: number;
}

/**
 * "Thành viên trong gia đình" — patients picked one at a time from the
 * clinic's records and listed as removable chips. Works inside a Form.Item.
 */
export function MemberPicker({ value = [], onChange, ownerId, max }: Props) {
  const { patients, search, hasMore, loadingMore, loadMore } = usePatientPicker(undefined);
  const taken = new Set([...value.map((member) => member.patientId), ownerId]);
  const full = value.length >= max;

  const handleAdd = (patientId: string | undefined) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient || taken.has(patient.id) || full) return;
    onChange?.([...value, { patientId: patient.id, label: `[${patient.code}] - ${patient.name}` }]);
  };

  return (
    <div className="prepaid-members">
      <SearchSelect
        value={undefined}
        disabled={full}
        placeholder={full ? t("PrepaidCard:Members:Full", max) : t("PrepaidCard:Members:Add")}
        options={patients
          .filter((p) => !taken.has(p.id))
          .map((p) => ({ value: p.id, label: `[${p.code}] - ${p.name.toUpperCase()}` }))}
        onSearch={search}
        filterLocally={false}
        onLoadMore={hasMore ? loadMore : undefined}
        loadingMore={loadingMore}
        onChange={handleAdd}
      />
      {value.length > 0 ? (
        <div className="prepaid-members__list">
          {value.map((member) => (
            <Tag
              key={member.patientId}
              closable
              onClose={() => onChange?.(value.filter((m) => m.patientId !== member.patientId))}
            >
              {member.label}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}
