import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import {
  durationLabel,
  elapsedShare,
  LABO_WARRANTY_STATE_PILL,
  remainingLabel,
  warrantyState,
} from "./laboWarrantyRules";
import { WarrantyCardFace } from "./WarrantyCardFace";

interface Props {
  tooth: LaboOrderToothDto;
  code: string;
  restoration: string;
  /** The clinic's logo, as the header shows it. */
  logoUrl: string;
  /** The card "Xem chi tiết" was pressed on (R-1120). */
  focused?: boolean;
}

/** "5 năm", or Chưa nhập before the card has a duration. */
function durationText(months: number | null | undefined): string {
  if (!months) return t("Labo:Warranty:NotEntered");
  const label = durationLabel(months);
  return t(label.key, label.value);
}

/** One Labo tooth's warranty card, with its code, validity and time left. */
export function LaboWarrantyCard({ tooth, code, restoration, logoUrl, focused }: Props) {
  const state = warrantyState(tooth);
  const left = tooth.warrantyEndDate ? remainingLabel(tooth.warrantyEndDate) : null;
  const face = {
    heading: t("Labo:Check:ToothLabel", tooth.toothNumber),
    code,
    what: [restoration, durationText(tooth.warrantyMonths)].filter(Boolean).join(" · "),
    startDate: tooth.warrantyStartDate,
    endDate: tooth.warrantyEndDate,
    state,
    elapsed: elapsedShare(tooth),
    left: left ? t(left.key, ...left.args) : t(LABO_WARRANTY_STATE_PILL.inactive.label),
    note: t(state === "inactive" ? "Labo:Warranty:AwaitingActivation" : "Labo:Warranty:NoClaimsYet"),
  };
  return <WarrantyCardFace face={face} logoUrl={logoUrl} focused={focused} />;
}
