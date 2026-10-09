import { Button, Radio, Tooltip } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { SearchSelect } from "@/components/SearchSelect";
import { usePatientPicker } from "@/hooks/usePatientOptions";
import { t } from "@/lib/i18n";
import { GROUP_KIND, GROUP_ROLE, type GroupKind, type MemberDraft } from "../types";

/** PatientRelationConsts.MaxGroupMembers. */
const MAX_MEMBERS = 30;

interface Props {
  value?: MemberDraft[];
  onChange?: (value: MemberDraft[]) => void;
  kind: GroupKind;
}

/**
 * The group's records, picked one at a time; the radio marks the one Chủ hộ /
 * Trưởng nhóm (clicking it again clears it). Works inside a Form.Item.
 */
export function GroupMembersEditor({ value = [], onChange, kind }: Props) {
  const { patients, search, hasMore, loadingMore, loadMore } = usePatientPicker(undefined);
  const taken = new Set(value.map((m) => m.patientId));
  const full = value.length >= MAX_MEMBERS;
  const headLabel = t(kind === GROUP_KIND.Family ? "PatientGroup:Role:HeadFamily" : "PatientGroup:Role:HeadOther");

  const add = (patientId: string | undefined) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient || taken.has(patient.id) || full) return;
    const role = value.length === 0 ? GROUP_ROLE.Head : GROUP_ROLE.Member;
    onChange?.([...value, { patientId: patient.id, label: `[${patient.code}] - ${patient.name}`, role }]);
  };

  const toggleHead = (patientId: string) =>
    onChange?.(
      value.map((m) => ({
        ...m,
        role: m.patientId === patientId && m.role !== GROUP_ROLE.Head ? GROUP_ROLE.Head : GROUP_ROLE.Member,
      })),
    );

  return (
    <div className="pg-members">
      <SearchSelect
        value={undefined}
        disabled={full}
        placeholder={full ? t("PatientGroup:MembersFull", MAX_MEMBERS) : t("PatientGroup:AddMember")}
        options={patients
          .filter((p) => !taken.has(p.id))
          .map((p) => ({ value: p.id, label: `[${p.code}] - ${p.name.toUpperCase()}` }))}
        onSearch={search}
        filterLocally={false}
        onLoadMore={hasMore ? loadMore : undefined}
        loadingMore={loadingMore}
        onChange={add}
      />
      {value.length === 0 ? (
        <p className="pg-muted">{t("PatientGroup:NoMembers")}</p>
      ) : (
        <ul className="pg-members__list">
          {value.map((m) => (
            <li key={m.patientId}>
              <span className="pg-members__name">{m.label}</span>
              <Radio checked={m.role === GROUP_ROLE.Head} onClick={() => toggleHead(m.patientId)}>
                {headLabel}
              </Radio>
              <Tooltip title={t("Common:Delete")}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t("PatientGroup:RemoveMember", m.label)}
                  onClick={() => onChange?.(value.filter((x) => x.patientId !== m.patientId))}
                />
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
