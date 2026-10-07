import { Button, Tag } from "antd";
import { DeleteOutlined, EditOutlined, PhoneOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { initialsOf, maskNationalId, RELATION_LABEL, type GuardianDraft } from "../../utils/guardian";

interface Props {
  guardian: GuardianDraft;
  consented: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** One guardian on the hồ sơ dialog's "Người giám hộ" pill — read-only, edited in the popup. */
export function GuardianCard({ guardian, consented, onEdit, onDelete }: Props) {
  const relation = guardian.relation ? t(RELATION_LABEL[guardian.relation]) : "";
  const relationText = guardian.relationNote.trim() ? `${relation} · ${guardian.relationNote}` : relation;

  return (
    <article className="bd-guardian-card" aria-label={guardian.fullName}>
      <header className="bd-guardian-card-head">
        <span className="bd-guardian-avatar" aria-hidden>
          {initialsOf(guardian.fullName)}
        </span>
        <div className="bd-min0 bd-guardian-card-who">
          <div className="bd-guardian-card-name">
            <strong>{guardian.fullName}</strong>
            {relationText && <Tag className="bd-guardian-tag">{relationText}</Tag>}
          </div>
          <span className="bd-guardian-card-phone">
            <PhoneOutlined /> {guardian.phone}
          </span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          aria-label={t("Patient:Guardian:Edit")}
          onClick={onEdit}
        />
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          aria-label={t("Patient:Guardian:Delete")}
          onClick={onDelete}
        />
      </header>

      <dl className="bd-guardian-card-facts">
        <dt>{t("Patient:Guardian:NationalIdShort")}</dt>
        <dd>{maskNationalId(guardian.nationalId)}</dd>
        <dt>{t("Patient:Guardian:Address")}</dt>
        <dd>{guardian.sameAddressAsPatient ? t("Patient:Guardian:SameAddressShort") : guardian.address || "—"}</dd>
        <dt>{t("Patient:Guardian:PrimaryContact")}</dt>
        <dd>{guardian.isPrimaryContact ? t("Patient:Guardian:Yes") : t("Patient:Guardian:No")}</dd>
        <dt>{t("Patient:Guardian:TreatmentConsent")}</dt>
        <dd className={consented ? "bd-guardian-ok" : undefined}>
          {consented ? t("Patient:Guardian:Confirmed") : t("Patient:Guardian:NotConfirmed")}
        </dd>
      </dl>
    </article>
  );
}
