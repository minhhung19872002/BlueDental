import type { KeyboardEvent, MouseEvent } from "react";
import { Button, Tag } from "antd";
import { CheckCircleFilled, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { PatientGuardianDto } from "../../types/patient";
import {
  formatPhoneGroups,
  initialsOf,
  maskNationalIdEnds,
  RELATION_LABEL,
} from "../../utils/guardian";

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
  expanded: boolean;
  onToggle: () => void;
  actions: GuardianCardActions | null;
}

function relationText(guardian: PatientGuardianDto) {
  const relation = t(RELATION_LABEL[guardian.relation]);
  return guardian.relationNote?.trim() ? `${relation} · ${guardian.relationNote}` : relation;
}

/** The pencil and the trash do their own job; they never fold the card. */
const stopFold = (event: MouseEvent) => event.stopPropagation();

/**
 * One người giám hộ on the record's Hồ sơ tab (BA mock 2026-10-07). The
 * primary contact opens with its details; the others fold them away. A click
 * anywhere on the card folds or unfolds it (owner, 2026-10-07: no chevron
 * button) — except while text is being selected, so a phone or an email can
 * still be copied. From the keyboard, the name block is the toggle.
 */
export function PatientGuardianCard({ guardian, occupation, expanded, onToggle, actions }: Props) {
  const className = ["pd-guardian", guardian.isPrimaryContact && "pd-guardian--primary"]
    .filter(Boolean)
    .join(" ");

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
        <span className="pd-guardian-avatar" aria-hidden>
          {initialsOf(guardian.fullName)}
        </span>
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
          <span className="pd-guardian-contact">
            {formatPhoneGroups(guardian.phone)} · {t("Patient:Guardian:NationalIdShort")}{" "}
            {maskNationalIdEnds(guardian.nationalId)}
          </span>
        </div>
        {actions && (
          <span className="pd-guardian-actions" onClick={stopFold}>
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
