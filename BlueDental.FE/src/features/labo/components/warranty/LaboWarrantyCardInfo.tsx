import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { LaboLockedField } from "../order-dialogs/LaboLockedField";
import { durationLabel, formatCardDate, isActivated } from "./laboWarrantyRules";

export interface LaboWarrantyCardFacts {
  tooth: LaboOrderToothDto;
  code: string;
  restoration: string;
  patientName: string;
  /** From the branch the user works in, never written into the card. */
  clinicName: string;
  /** The clinic's logo, as the header shows it. */
  logoUrl: string;
}

/** The card as the patient holds it: clinic, patient, code, what and which tooth, validity. */
function PreviewCard({ tooth, code, restoration, patientName, clinicName, logoUrl }: LaboWarrantyCardFacts) {
  return (
    <aside className="pd-labo-warranty-preview" aria-label={t("Labo:Warranty:Preview")}>
      <span className="pd-labo-warranty-preview-head">
        <img src={logoUrl} alt="" className="pd-labo-warranty-logo" />
        <strong>{clinicName}</strong>
        <span>{t("Labo:Warranty:CardTitle")}</span>
      </span>
      <strong className="pd-labo-warranty-preview-name">{patientName}</strong>
      <span>
        {t("Labo:Warranty:PreviewCode")} <strong>{code}</strong>
      </span>
      <span>{t("Labo:Warranty:RestorationTooth", restoration, tooth.toothNumber)}</span>
      <span>
        {t("Labo:Warranty:Validity", formatCardDate(tooth.warrantyStartDate), formatCardDate(tooth.warrantyEndDate))}
      </span>
    </aside>
  );
}

/** Thông tin thẻ: the card's facts locked, label on the border, beside the card itself. */
export function LaboWarrantyCardInfo(facts: LaboWarrantyCardFacts) {
  const { tooth, code, restoration } = facts;
  const duration = tooth.warrantyMonths ? durationLabel(tooth.warrantyMonths) : null;
  const conditions = t("Labo:Warranty:Info:Conditions");
  return (
    <div className="pd-labo-warranty-info">
      <div className="pd-labo-warranty-info-fields">
        <LaboLockedField label={t("Labo:Warranty:Info:Code")} value={code} required={false} />
        <LaboLockedField
          label={t("Labo:Warranty:Info:Restoration")}
          value={t("Labo:Warranty:RestorationTooth", restoration, tooth.toothNumber)}
          required={false}
        />
        <LaboLockedField
          label={t("Labo:Warranty:Duration")}
          value={duration ? t(duration.key, duration.value) : t("Labo:Warranty:NotEntered")}
          required={false}
        />
        <LaboLockedField label={t("Labo:Warranty:Info:Serial")} value={tooth.manufacturerSerial || "—"} required={false} />
        <LaboLockedField
          label={t("Labo:Warranty:StartDate")}
          value={formatCardDate(tooth.warrantyStartDate)}
          required={false}
        />
        <LaboLockedField
          label={t("Labo:Warranty:Info:EndDate")}
          value={formatCardDate(tooth.warrantyEndDate)}
          required={false}
        />
        {/* A TextArea, so long conditions wrap instead of being cut off. */}
        <FloatingLabel label={conditions} floated className="pd-labo-warranty-info-wide">
          <Input.TextArea value={tooth.warrantyConditions || "—"} autoSize disabled aria-label={conditions} />
        </FloatingLabel>
        {!isActivated(tooth) && <p className="pd-labo-warranty-note">{t("Labo:Warranty:InactiveNote")}</p>}
      </div>
      <PreviewCard {...facts} />
    </div>
  );
}
