import { Select, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { SearchSelect } from "@/components/SearchSelect";
import { usePatientFamily } from "@/hooks/usePatientFamily";
import { usePatientPicker } from "@/hooks/usePatientOptions";
import { t } from "@/lib/i18n";
import { relationLabel, relationOptions, type PatientRelationType } from "@/utils/patientRelation";

export interface MemberChoice {
  patientId: string;
  label: string;
  /** What the member is to the owner — asked only when they are not yet người nhà. */
  relation?: PatientRelationType;
  /** Already on the card before this edit: kept whatever the family records say. */
  existing?: boolean;
}

interface Props {
  value?: MemberChoice[];
  onChange?: (value: MemberChoice[]) => void;
  /** The card's owner, who is never a member of their own card. */
  ownerId?: string;
  max: number;
}

/** The members as the API takes them, with the relations picked for newcomers. */
export function toMembersInput(members: MemberChoice[]): { memberPatientIds: string[]; newRelations: { patientId: string; type: number }[] } {
  return {
    memberPatientIds: members.map((m) => m.patientId),
    newRelations: members
      .filter((m): m is MemberChoice & { relation: PatientRelationType } => m.relation !== undefined)
      .map((m) => ({ patientId: m.patientId, type: m.relation })),
  };
}

/** Members that are neither người nhà of the owner nor kept from before, and have no relation picked. */
export function membersMissingRelation(members: MemberChoice[], familyIds: ReadonlySet<string>): MemberChoice[] {
  return members.filter((m) => !m.existing && !familyIds.has(m.patientId) && !m.relation);
}

/**
 * "Thành viên trong gia đình" of a family card (3.1). The owner's người nhà —
 * Mối quan hệ, guardians, family group — are offered as one-tap chips. Anyone
 * else may be searched for, but then says what they are to the owner; the
 * relation is recorded with the card (Mối quan hệ 4.8). Works inside a Form.Item.
 */
export function MemberPicker({ value = [], onChange, ownerId, max }: Props) {
  const { patients, search, hasMore, loadingMore, loadMore } = usePatientPicker(undefined);
  const { data: family = [] } = usePatientFamily(ownerId);
  const familyIds = new Set(family.map((f) => f.relatedPatientId));
  const taken = new Set([...value.map((member) => member.patientId), ownerId]);
  const full = value.length >= max;
  const suggestions = family.filter((f) => !taken.has(f.relatedPatientId));

  const addMember = (member: MemberChoice) => {
    if (taken.has(member.patientId) || full) return;
    onChange?.([...value, member]);
  };

  const handleSearchPick = (patientId: string | undefined) => {
    const patient = patients.find((p) => p.id === patientId);
    if (patient) addMember({ patientId: patient.id, label: `[${patient.code}] - ${patient.name}` });
  };

  const setRelation = (patientId: string, relation: PatientRelationType) =>
    onChange?.(value.map((m) => (m.patientId === patientId ? { ...m, relation } : m)));

  return (
    <div className="prepaid-members">
      {suggestions.length > 0 && !full ? (
        <div className="prepaid-members__suggest">
          <small>{t("PrepaidCard:Members:Suggest")}</small>
          {suggestions.map((f) => (
            <Tag
              key={f.relatedPatientId}
              className="prepaid-members__chip"
              icon={<PlusOutlined />}
              onClick={() => addMember({ patientId: f.relatedPatientId, label: `[${f.relatedPatientCode}] - ${f.relatedPatientName}` })}
            >
              {f.relatedPatientName}
              {f.type ? ` (${relationLabel(f.type, f.relatedPatientGender)})` : ""}
            </Tag>
          ))}
        </div>
      ) : null}
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
        onChange={handleSearchPick}
      />
      {value.length > 0 ? (
        <ul className="prepaid-members__list">
          {value.map((member) => {
            const known = member.existing || familyIds.has(member.patientId);
            return (
              <li key={member.patientId}>
                <span className="prepaid-members__name">{member.label}</span>
                {known ? (
                  <Tag color="green">{t("PrepaidCard:Members:IsFamily")}</Tag>
                ) : (
                  <Select<PatientRelationType>
                    size="small"
                    className="prepaid-members__relation"
                    status={member.relation ? undefined : "error"}
                    placeholder={t("PrepaidCard:Members:RelationToOwner")}
                    aria-label={t("PrepaidCard:Members:RelationOf", member.label)}
                    value={member.relation}
                    options={relationOptions(true)}
                    onChange={(relation) => setRelation(member.patientId, relation)}
                  />
                )}
                <Tag
                  closable
                  className="prepaid-members__remove"
                  onClose={() => onChange?.(value.filter((m) => m.patientId !== member.patientId))}
                >
                  {t("PrepaidCard:Members:Remove")}
                </Tag>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
