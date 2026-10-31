import { FlaskConical, Shield } from "lucide-react";
import {
  WARRANTY_CARD_KIND,
  type WarrantyCardKind,
} from "@/features/treatment-management/api/planWarrantyApi";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LineCover } from "./stageWarranty";

interface Props {
  cover: LineCover | undefined;
  picked: WarrantyCardKind | undefined;
  /** An open warranty chain keeps the card it was opened under. */
  locked: boolean;
  error?: string;
  /** `undefined` = the picked card clicked again: nothing picked. */
  onPick: (kind: WarrantyCardKind | undefined) => void;
}

interface CardProps {
  kind: WarrantyCardKind;
  /** Whether a valid card of this kind exists on the line (REQ-F3: else faded). */
  available: boolean;
  picked: boolean;
  locked: boolean;
  detail: string;
  /** `undefined` = the picked card clicked again: nothing picked. */
  onPick: (kind: WarrantyCardKind | undefined) => void;
}

const CARD_LOOK = {
  [WARRANTY_CARD_KIND.Dental]: { tone: "dental", label: "Patient:Stage:WarrantyCardDental", Icon: Shield },
  [WARRANTY_CARD_KIND.Labo]: { tone: "labo", label: "Patient:Stage:WarrantyCardLabo", Icon: FlaskConical },
} as const;

function WarrantyCard({ kind, available, picked, locked, detail, onPick }: CardProps) {
  const { tone, label, Icon } = CARD_LOOK[kind];
  const className = ["pd-wcard", `pd-wcard--${tone}`, picked && "pd-wcard--picked"].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={className}
      aria-pressed={picked}
      disabled={locked || !available}
      onClick={() => onPick(picked ? undefined : kind)}
    >
      <span className="pd-wcard-head">
        <Icon aria-hidden size={15} strokeWidth={2} />
        {t(label)}
      </span>
      <span className="pd-wcard-detail">{detail}</span>
    </button>
  );
}

/**
 * "Thẻ bảo hành áp dụng *" (P3110 REQ-F3, m394/m415): one of the line's two
 * kinds of card. Nha khoa names its end date; Labo how many orders it may be
 * worked under — the order itself is picked under Nội dung điều trị (REQ-F4).
 */
export function StageWarrantyCardPick({ cover, picked, locked, error, onPick }: Props) {
  const dental = cover?.dental ?? null;
  const labo = cover?.labo ?? [];
  const none = t("Patient:Stage:WarrantyNoValidCard");

  return (
    <div className="pd-wcards-field">
      <p className="pd-wcards-label">
        {t("Patient:Stage:WarrantyCardApplied")} <span className="floating-field-required">*</span>
      </p>
      <div className={["pd-wcards", error && "pd-wcards--error"].filter(Boolean).join(" ")}>
        <WarrantyCard
          kind={WARRANTY_CARD_KIND.Dental}
          available={dental !== null}
          picked={picked === WARRANTY_CARD_KIND.Dental}
          locked={locked}
          detail={dental ? t("Patient:Stage:WarrantyCardUntil", formatDate(dental.until)) : none}
          onPick={onPick}
        />
        <WarrantyCard
          kind={WARRANTY_CARD_KIND.Labo}
          available={labo.length > 0}
          picked={picked === WARRANTY_CARD_KIND.Labo}
          locked={locked}
          detail={labo.length > 0 ? t("Patient:Stage:WarrantyCardLaboCount", labo.length) : none}
          onPick={onPick}
        />
      </div>
      {error && <p className="pd-stage-error">{error}</p>}
    </div>
  );
}
