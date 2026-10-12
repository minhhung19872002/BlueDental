import { Button, Radio, Select, Tooltip } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { SearchSelect } from "@/components/SearchSelect";
import { usePatientPicker } from "@/hooks/usePatientOptions";
import { t } from "@/lib/i18n";
import { relationOptions, type PatientRelationType } from "@/utils/patientRelation";
import type { KnownRelation } from "../hooks/useHeadRelations";
import { GROUP_KIND, GROUP_ROLE, type GroupKind, type MemberDraft } from "../types";

/** PatientRelationConsts.MaxGroupMembers. */
const MAX_MEMBERS = 30;

/** A family's members are người nhà of its Chủ hộ: blood and marriage only. */
const FAMILY_RELATIONS = relationOptions(true);

interface Props {
  value?: MemberDraft[];
  onChange?: (value: MemberDraft[]) => void;
  kind: GroupKind;
  /** The Chủ hộ's relations on file, by the other record's id. */
  known: ReadonlyMap<string, KnownRelation>;
}

/**
 * The group's records, picked one at a time; the radio marks the one Chủ hộ /
 * Trưởng nhóm (clicking it again clears it). In a family each other member
 * says what they are to the Chủ hộ — saved as Mối quan hệ (owner, 2026-10-12).
 * Works inside a Form.Item.
 */
export function GroupMembersEditor({ value = [], onChange, kind, known }: Props) {
  const { patients, search, hasMore, loadingMore, loadMore } = usePatientPicker(undefined);
  const taken = new Set(value.map((m) => m.patientId));
  const full = value.length >= MAX_MEMBERS;
  const isFamily = kind === GROUP_KIND.Family;
  const hasHead = value.some((m) => m.role === GROUP_ROLE.Head);
  const headLabel = t(isFamily ? "PatientGroup:Role:HeadFamily" : "PatientGroup:Role:HeadOther");

  const add = (patientId: string | undefined) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient || taken.has(patient.id) || full) return;
    const role = value.length === 0 ? GROUP_ROLE.Head : GROUP_ROLE.Member;
    onChange?.([...value, { patientId: patient.id, label: `[${patient.code}] - ${patient.name}`, role }]);
  };

  // Relations are to the Chủ hộ, so a new head starts them over.
  const toggleHead = (patientId: string) =>
    onChange?.(
      value.map((m) => ({
        ...m,
        role: m.patientId === patientId && m.role !== GROUP_ROLE.Head ? GROUP_ROLE.Head : GROUP_ROLE.Member,
        relationToHead: undefined,
      })),
    );

  const setRelation = (patientId: string, relationToHead: PatientRelationType) =>
    onChange?.(value.map((m) => (m.patientId === patientId ? { ...m, relationToHead } : m)));

  const relationCell = (m: MemberDraft) => {
    if (!isFamily || m.role === GROUP_ROLE.Head || !hasHead) return null;
    const onFile = known.get(m.patientId);
    const select = (
      <Select<PatientRelationType>
        size="small"
        className="pg-members__relation"
        placeholder={t("PatientGroup:Field:RelationToHead")}
        aria-label={`${t("PatientGroup:Field:RelationToHead")} ${m.label}`}
        value={m.relationToHead ?? onFile?.type}
        options={FAMILY_RELATIONS}
        disabled={onFile?.setByGuardian}
        onChange={(type) => setRelation(m.patientId, type)}
      />
    );
    return onFile?.setByGuardian ? <Tooltip title={t("PatientGroup:RelationByGuardian")}>{select}</Tooltip> : select;
  };

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
              {relationCell(m)}
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
