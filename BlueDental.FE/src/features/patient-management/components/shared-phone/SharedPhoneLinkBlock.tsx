import { Select } from "antd";
import { t } from "@/lib/i18n";
import { relationLabel, SHARED_PHONE_RELATIONS, type PatientRelationType } from "@/utils/patientRelation";
import type { SharedPhoneLinkState } from "../../hooks/useSharedPhoneLink";

interface Props {
  link: SharedPhoneLinkState;
  holderCount: number;
  onShowHolders: () => void;
}

/**
 * "Liên kết người dùng chung SĐT" under the phone field (P2710_02): "Là …" and
 * "của …" — what the hồ sơ being saved is to one already on the number. Lưu
 * waits for both.
 */
export function SharedPhoneLinkBlock({ link, holderCount, onShowHolders }: Props) {
  const relationChoices = SHARED_PHONE_RELATIONS.map((type) => ({ value: type, label: relationLabel(type) }));
  const anchorChoices = link.anchors.map((owner) => ({
    value: owner.id,
    label: t("Patient:SharedPhone:OfName", owner.patientName),
  }));

  return (
    <div className="bd-phone-link">
      <div className="bd-phone-link-head">
        <span className="bd-phone-link-title">{t("Patient:SharedPhone:LinkTitle")}</span>
        <button type="button" className="bd-phone-link-count" onClick={onShowHolders}>
          {t("Patient:SharedPhone:HoldersOnNumber", holderCount)}
        </button>
      </div>

      <div className="bd-phone-link-row">
        <Select<PatientRelationType>
          aria-label={t("Patient:SharedPhone:RelationLabel")}
          placeholder={t("Patient:SharedPhone:RelationPlaceholder")}
          value={link.relation}
          options={relationChoices}
          popupMatchSelectWidth={false}
          status={link.error ? "error" : undefined}
          onChange={link.setRelation}
        />
        <Select<string>
          aria-label={t("Patient:SharedPhone:AnchorLabel")}
          placeholder={t("Patient:SharedPhone:AnchorPlaceholder")}
          value={link.anchor?.id}
          options={anchorChoices}
          popupMatchSelectWidth={false}
          status={link.error ? "error" : undefined}
          onChange={link.setAnchorId}
        />
      </div>

      {link.error ? (
        <div className="bd-phone-link-error" role="alert">
          {link.error}
        </div>
      ) : (
        link.relation === undefined && <div className="bd-phone-link-hint">{t("Patient:SharedPhone:PickRelation")}</div>
      )}
    </div>
  );
}
