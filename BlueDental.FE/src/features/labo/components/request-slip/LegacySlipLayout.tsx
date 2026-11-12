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
 * The fixed Phiếu yêu cầu (F-91, R-1216): Thông tin phiếu, then three columns
 * — Loại phục hình (Dịch vụ → Vật liệu), Màu răng, then Chỉ định with Đường
 * hoàn tất, Kiểu nhịp and Khớp cắn — then Thông tin bổ sung when the slip
 * holds a template copy without a layout, and Yêu cầu.
 */
export function LegacySlipLayout({ parts, extra, editable, onAnswer }: Props) {
  return (
    <>
      {parts.info()}
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
