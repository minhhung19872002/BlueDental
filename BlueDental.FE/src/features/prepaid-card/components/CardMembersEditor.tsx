import { useEffect, useState } from "react";
import { Button, Tag } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { usePatientFamily } from "@/hooks/usePatientFamily";
import { t } from "@/lib/i18n";
import type { CardDetailDto, MembersInput } from "../types";
import { MemberPicker, membersMissingRelation, toMembersInput, type MemberChoice } from "./MemberPicker";

const MAX_MEMBERS = 10;

interface Props {
  card: CardDetailDto;
  saving: boolean;
  /** Left out when the account may not change members — the list is then read-only. */
  onSave?: (input: MembersInput) => void;
}

/** The card's members as they stand — kept as they are, whatever the family records say. */
const choicesOf = (card: CardDetailDto): MemberChoice[] =>
  card.members.map((m) => ({ patientId: m.patientId, label: `[${m.code ?? "—"}] - ${m.name ?? "—"}`, existing: true }));

/** "Thành viên gia đình" of one card: who besides the owner may spend it. */
export function CardMembersEditor({ card, saving, onSave }: Props) {
  const [members, setMembers] = useState<MemberChoice[]>(() => choicesOf(card));
  useEffect(() => setMembers(choicesOf(card)), [card]);
  const { data: family = [] } = usePatientFamily(card.allowFamily ? card.ownerPatientId : undefined);
  const missing = membersMissingRelation(members, new Set(family.map((f) => f.relatedPatientId)));

  if (!card.allowFamily) return <p className="prepaid-muted">{t("PrepaidCard:Members:NotAllowed")}</p>;

  if (!onSave) {
    return card.members.length === 0 ? (
      <p className="prepaid-muted">{t("PrepaidCard:Members:None")}</p>
    ) : (
      <div className="prepaid-members__list">
        {choicesOf(card).map((m) => (
          <Tag key={m.patientId}>{m.label}</Tag>
        ))}
      </div>
    );
  }

  const changed =
    members.map((m) => m.patientId).join() !== card.members.map((m) => m.patientId).join();

  return (
    <div className="prepaid-members-editor">
      <MemberPicker value={members} onChange={setMembers} ownerId={card.ownerPatientId} max={MAX_MEMBERS} />
      <Button
        icon={<SaveOutlined />}
        disabled={!changed || saving || missing.length > 0}
        loading={saving}
        onClick={() => onSave(toMembersInput(members))}
      >
        {t("PrepaidCard:Members:Save")}
      </Button>
    </div>
  );
}
