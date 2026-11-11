import { t } from "@/lib/i18n";
import { LABO_BLOCK_KIND } from "@/features/labo/api/laboFormTemplateApi";
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
 * The fixed Phiếu yêu cầu (F-91, BA P1011): Thông tin phiếu, then Loại phục
 * hình in three columns — Toàn sứ and Hợp kim, then Phục hình khác trên implant
 * with Màu răng, then Chỉ định with Đường hoàn tất — then Thông tin bổ sung
 * when the slip holds a template copy without a layout, and Yêu cầu.
 */
export function LegacySlipLayout({ parts, extra, editable, onAnswer }: Props) {
  return (
    <>
      {parts.info()}
      {parts.restorationHeading()}
      <div className="rs-main">
        <div className="rs-col">
          {parts.restorationCard(LABO_BLOCK_KIND.AllCeramic)}
          {parts.restorationCard(LABO_BLOCK_KIND.Alloy)}
          {!parts.hasRestorations && <p className="rs-empty">{t("Labo:Slip:NoRestorations")}</p>}
        </div>
        <div className="rs-col">
          {parts.restorationCard(LABO_BLOCK_KIND.OtherOnImplant)}
          {parts.shade()}
        </div>
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
