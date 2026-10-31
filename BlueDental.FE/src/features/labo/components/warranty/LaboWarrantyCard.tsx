import type { CSSProperties } from "react";
import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import {
  durationLabel,
  elapsedShare,
  formatCardDate,
  LABO_WARRANTY_STATE_PILL,
  remainingLabel,
  warrantyState,
} from "./laboWarrantyRules";

interface Props {
  tooth: LaboOrderToothDto;
  code: string;
  restoration: string;
  /** The clinic's logo, as the header shows it. */
  logoUrl: string;
}

/** "5 năm", or Chưa nhập before the card has a duration. */
function durationText(months: number | null | undefined): string {
  if (!months) return t("Labo:Warranty:NotEntered");
  const label = durationLabel(months);
  return t(label.key, label.value);
}

/**
 * One tooth's warranty card: purple once activated, grey before, with its
 * code, validity and time left.
 */
export function LaboWarrantyCard({ tooth, code, restoration, logoUrl }: Props) {
  const state = warrantyState(tooth);
  const pill = LABO_WARRANTY_STATE_PILL[state];
  const left = tooth.warrantyEndDate ? remainingLabel(tooth.warrantyEndDate) : null;
  const elapsed = { "--pd-warranty-elapsed": `${Math.round(elapsedShare(tooth) * 100)}%` } as CSSProperties;

  return (
    <article className={`pd-labo-warranty-card pd-labo-warranty-card--${state}`} aria-label={t("Labo:Warranty:CardCode", code)}>
      <span className="pd-labo-warranty-card-head">
        <img src={logoUrl} alt="" className="pd-labo-warranty-logo" />
        <strong>{t("Labo:Check:ToothLabel", tooth.toothNumber)}</strong>
        {/* Tinted from the card's own text colour, so it reads on slate, purple and red. */}
        <span className="pd-labo-warranty-card-pill">{t(pill.label)}</span>
      </span>
      <span className="pd-labo-warranty-card-code">{t("Labo:Warranty:CardCode", code)}</span>
      <span className="pd-labo-warranty-card-what">
        {[restoration, durationText(tooth.warrantyMonths)].filter(Boolean).join(" · ")}
      </span>
      <span>
        {t(
          "Labo:Warranty:Validity",
          formatCardDate(tooth.warrantyStartDate),
          formatCardDate(tooth.warrantyEndDate),
        )}
      </span>
      <span className="pd-labo-warranty-card-bar" style={elapsed} />
      <span className="pd-labo-warranty-card-foot">
        <span>{left ? t(left.key, ...left.args) : t(LABO_WARRANTY_STATE_PILL.inactive.label)}</span>
        <span>{t(state === "inactive" ? "Labo:Warranty:AwaitingActivation" : "Labo:Warranty:NoClaimsYet")}</span>
      </span>
    </article>
  );
}
