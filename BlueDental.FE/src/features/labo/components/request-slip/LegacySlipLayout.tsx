import { t } from "@/lib/i18n";
import { ExtraFormSection } from "./ExtraFormSection";
import type { ExtraFormValues } from "./extraFormModel";
import type { SlipParts } from "./useSlipParts";

interface Props {
  parts: SlipParts;
  /** A copy made before layouts (F-93): its fields as one unprinted section. */
  extra: ExtraFormValues | null;
  editable: boolean;
  onAnswer: (key: string, values: string[]) => void;
}

/**
 * The fixed Phiếu yêu cầu (F-91, R-1216, P1311): Thông tin phiếu, the Dịch vụ &
 * vật liệu heading with what is picked, then three columns — Dịch vụ over its
 * Vật liệu, Màu răng, then Chỉ định with Đường
 * hoàn tất, Kiểu nhịp and Khớp cắn — then Thông tin bổ sung when the slip
 * holds a template copy without a layout, and Yêu cầu.
 */
export function LegacySlipLayout({ parts, extra, editable, onAnswer }: Props) {
  return (
    <>
      {parts.info()}
      <div className="rs-band">
        <h3 className="rs-band-title">{t("Labo:Slip:Restoration")}</h3>
        <span className="rs-band-rule" aria-hidden="true" />
        <span className="rs-band-picked">
          {t("Labo:Slip:PickedSummary")} <b>{parts.picked || t("Labo:Slip:NoMaterialPicked")}</b>
        </span>
      </div>
      <div className="rs-main">
        <div className="rs-col">{parts.restoration()}</div>
        <div className="rs-col">{parts.shade()}</div>
        <div className="rs-col">
          {parts.teeth()}
          {parts.finishLines()}
        </div>
      </div>
      {extra && (
        <ExtraFormSection
          title={t("Labo:Slip:Extra")}
          fields={extra.fields}
          answers={extra.answers}
          editable={editable}
          unprinted
          onAnswer={onAnswer}
        />
      )}
      {parts.notes()}
    </>
  );
}
