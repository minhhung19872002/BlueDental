import type { KeyboardEvent, MouseEvent } from "react";
import { Button, Tag } from "antd";
import { CheckCircleFilled, DeleteOutlined, EditOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LinkedGuardian, PatientGuardianDto } from "../../types/patient";
import { formatPhoneGroups, maskNationalIdEnds, RELATION_LABEL } from "../../utils/guardian";
import { HolderAvatar } from "../shared-phone/HolderCard";
import { holderLineWithAge } from "../shared-phone/holderMeta";

/** What the viewer may do with the card; null hides both buttons. */
export interface GuardianCardActions {
  onEdit: () => void;
  onDelete: () => void;
  /** Why the trash is off — the last guardian of an under-16 record. */
  deleteBlockedReason: string | null;
}

interface Props {
  guardian: PatientGuardianDto;
  occupation: string | null;
  /** The guardian's own hồ sơ (P2710_02), when they have one. */
  linked: LinkedGuardian | null;
  expanded: boolean;
  onToggle: () => void;
  onOpenRecord: (patientId: string) => void;
  actions: GuardianCardActions | null;
}

function relationText(guardian: PatientGuardianDto) {
  const relation = t(RELATION_LABEL[guardian.relation]);
  return guardian.relationNote?.trim() ? `${relation} · ${guardian.relationNote}` : relation;
}

/** The pencil, the trash and the chevron do their own job; they never fold the card. */
const stopFold = (event: MouseEvent) => event.stopPropagation();

/**
 * One người giám hộ on the record's Hồ sơ tab (BA mock 2026-10-07), dressed
 * like the "Người dùng chung SĐT" cards (P2710_02): avatar, name with its
 * tags, then "mã · tuổi · khám gần nhất" — the code only once the guardian has
 * a hồ sơ, which the chevron then opens. The primary contact opens with its
 * details; the others fold them away. A click anywhere on the card folds or
 * unfolds it (owner, 2026-10-07) — except while text is being selected, so a
 * phone or an email can still be copied. From the keyboard, the name block is
 * the toggle.
 */
export function PatientGuardianCard({ guardian, occupation, linked, expanded, onToggle, onOpenRecord, actions }: Props) {
  const className = ["pd-guardian", guardian.isPrimaryContact && "pd-guardian--primary"]
    .filter(Boolean)
    .join(" ");
  const meta = holderLineWithAge({
    patientCode: linked?.patientCode ?? null,
    dateOfBirth: guardian.dateOfBirth,
    lastVisitAt: linked?.lastVisitAt ?? null,
  });

  const handleCardClick = () => {
    if (window.getSelection()?.toString()) return;
    onToggle();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggle();
  };

  return (
    <article className={className} aria-label={guardian.fullName} onClick={handleCardClick}>
      <header className="pd-guardian-head">
        <HolderAvatar name={guardian.fullName} />
        <div
          className="pd-guardian-who"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onKeyDown={handleKeyDown}
        >
          <div className="pd-guardian-name">
            <strong>{guardian.fullName}</strong>
            <Tag className="pd-guardian-relation">{relationText(guardian)}</Tag>
            {guardian.isPrimaryContact && (
              <Tag className="pd-guardian-primary">{t("Patient:Guardian:PrimaryBadge")}</Tag>
            )}
          </div>
          {meta && <span className="bd-holder-meta">{meta}</span>}
          <span className="pd-guardian-contact">
            {formatPhoneGroups(guardian.phone)} · {t("Patient:Guardian:NationalIdShort")}{" "}
            {maskNationalIdEnds(guardian.nationalId)}
          </span>
        </div>
        {(actions || linked) && (
          <span className="pd-guardian-actions" onClick={stopFold}>
            {actions && (
              <>
                <Button
                  size="small"
                  className="pd-guardian-edit"
                  icon={<EditOutlined />}
                  aria-label={t("Patient:Guardian:Edit")}
                  onClick={actions.onEdit}
                />
                <Button
                  size="small"
                  danger
                  className="pd-guardian-delete"
                  icon={<DeleteOutlined />}
                  aria-label={t("Patient:Guardian:Delete")}
                  title={actions.deleteBlockedReason ?? undefined}
                  disabled={actions.deleteBlockedReason !== null}
                  onClick={actions.onDelete}
                />
              </>
            )}
            {linked && (
              <Button
                type="text"
                size="small"
                className="pd-guardian-open"
                icon={<RightOutlined />}
                aria-label={t("Patient:SharedPhone:OpenMember", guardian.fullName)}
                onClick={() => onOpenRecord(linked.patientId)}
              />
            )}
          </span>
        )}
      </header>

      {expanded && (
        <dl className="pd-guardian-facts">
          <div>
            <dt>{t("Patient:Guardian:DateOfBirth")}</dt>
            <dd>{guardian.dateOfBirth ? dayjs(guardian.dateOfBirth).format("DD/MM/YYYY") : "—"}</dd>
          </div>
          <div>
            <dt>{t("Patient:Guardian:Email")}</dt>
            <dd>{guardian.email || "—"}</dd>
          </div>
          <div>
            <dt>{t("Patient:Guardian:Occupation")}</dt>
            <dd>{occupation || "—"}</dd>
          </div>
          <div>
            <dt>{t("Patient:Guardian:Address")}</dt>
            <dd>
              {guardian.sameAddressAsPatient
                ? t("Patient:Guardian:SameAddressShort")
                : guardian.address || "—"}
            </dd>
          </div>
        </dl>
      )}

      <p className="pd-guardian-consent">
        <CheckCircleFilled /> {t("Patient:Guardian:ConsentedOn", formatDate(guardian.consentedAt))}
      </p>
    </article>
  );
}
