import { PlusOutlined, RightOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PhoneGuardian, PhoneOwner } from "../../types/patient";
import { formatPhoneGroups, RELATION_LABEL } from "../../utils/guardian";
import { HolderCard, type HolderChip } from "./HolderCard";
import { holderLineWithGender, relationChip } from "./holderMeta";

/** What a row of the dropdown does; the dialog decides per flow (P2710_02). */
export interface HolderHandlers {
  /** The row's body: use that hồ sơ in the flow, or open it. */
  onPickOwner: (owner: PhoneOwner) => void;
  /** "Mở hồ sơ ›". */
  onOpenOwner: (owner: PhoneOwner) => void;
  /** A guardian without a hồ sơ: their details fill the form once. */
  onPickGuardian: (guardian: PhoneGuardian) => void;
}

interface Props {
  phone: string;
  owners: readonly PhoneOwner[];
  /** Empty when editing: only a new hồ sơ is made from a guardian. */
  guardians: readonly PhoneGuardian[];
  handlers: HolderHandlers;
  footerLabel: string;
  /** The footer: someone new on the same number — the list just closes. */
  onNewPerson: () => void;
}

function ownerChip(owner: PhoneOwner): HolderChip | null {
  if (owner.isPhoneOwner) return { label: t("Patient:SharedPhone:PhoneOwner"), tone: "owner" };
  const label = relationChip(owner.relationType, owner.relatedToName);
  return label ? { label, tone: "plain" } : null;
}

const givenNames = (guardian: PhoneGuardian) =>
  guardian.wards.map((ward) => ward.fullName.trim().split(/\s+/).pop()).join(", ");

function guardianLine(guardian: PhoneGuardian): string {
  const facts = holderLineWithGender({ ...guardian, patientCode: null, lastVisitAt: null });
  return [t(RELATION_LABEL[guardian.relation]), facts, t("Patient:SharedPhone:NoRecord")].filter(Boolean).join(" · ");
}

/**
 * "SĐT … đã có N hồ sơ · Khách là ai?" — hangs under the phone field once the
 * number turns out to be on file: every hồ sơ on it (Chủ số first), then the
 * guardians declared on it who have no hồ sơ yet, then "Người mới".
 */
export function PhoneHoldersDropdown({ phone, owners, guardians, handlers, footerLabel, onNewPerson }: Props) {
  const count =
    owners.length > 0
      ? t("Patient:SharedPhone:HasRecords", owners.length)
      : t("Patient:SharedPhone:HasGuardians", guardians.length);

  return (
    <div className="bd-phone-holders" role="region" aria-label={t("Patient:SharedPhone:DropdownLabel")}>
      <div className="bd-phone-holders-head">
        {t("Patient:SharedPhone:PhoneLabel")} <strong>{formatPhoneGroups(phone)}</strong> {count}
        <span className="bd-phone-holders-ask">{t("Patient:SharedPhone:WhoIsIt")}</span>
      </div>

      <div className="bd-phone-holders-list">
        {owners.map((owner) => (
          <HolderCard
            key={owner.id}
            className="bd-holder--row"
            name={owner.patientName}
            chip={ownerChip(owner)}
            meta={holderLineWithGender(owner)}
            onSelect={() => handlers.onPickOwner(owner)}
            trailing={
              <button type="button" className="bd-holder-open" onClick={() => handlers.onOpenOwner(owner)}>
                {t("Patient:SharedPhone:OpenRecord")} <RightOutlined />
              </button>
            }
          />
        ))}
        {guardians.map((guardian) => (
          <HolderCard
            key={guardian.guardianId}
            className="bd-holder--row"
            name={guardian.fullName}
            chip={{ label: t("Patient:SharedPhone:GuardianOf", givenNames(guardian)), tone: "plain" }}
            meta={guardianLine(guardian)}
            onSelect={() => handlers.onPickGuardian(guardian)}
          />
        ))}
      </div>

      <button type="button" className="bd-phone-holders-new" onClick={onNewPerson}>
        <span className="bd-phone-holders-plus" aria-hidden>
          <PlusOutlined />
        </span>
        {footerLabel}
      </button>
    </div>
  );
}
