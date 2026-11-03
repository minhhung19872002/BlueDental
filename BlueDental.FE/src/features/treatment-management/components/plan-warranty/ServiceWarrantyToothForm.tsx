import { Form } from "antd";
import type { WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { toothKey } from "@/features/labo/components/check/laboCheckRules";
import { LaboWarrantyCardFields } from "@/features/labo/components/warranty/LaboWarrantyCardFields";
import { LaboWarrantyReadiness } from "@/features/labo/components/warranty/LaboWarrantyReadiness";
import { warrantyToothFormId } from "@/features/labo/components/warranty/laboWarrantyRules";
import type { LaboWarrantyCardValues } from "@/features/labo/components/warranty/useLaboWarrantyForm";
import { t } from "@/lib/i18n";
import type { WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { catalogDaysOf, completedDay, completedOnText } from "./serviceWarrantyRules";
import { NO_TOOTH } from "./useServiceWarrantyForm";

interface Props {
  /** NO_TOOTH on a line without teeth. */
  tooth: number;
  row: WarrantyServiceRowDto;
  photos: WarrantyCardDrafts;
  busy: boolean;
  /** Jumped to from its row in 1. Chọn răng kích hoạt. */
  focused: boolean;
}

/**
 * 2. One dental card (REQ-B5) on the frame of a Labo tooth's card: Ngày bắt
 * đầu, Ngày hết hạn worked out, Thời hạn — "Theo danh mục" first —, Điều
 * kiện and the optional photos. A dental card carries no serial.
 */
export function ServiceWarrantyToothForm({ tooth, row, photos, busy, focused }: Props) {
  const card: LaboWarrantyCardValues | undefined = Form.useWatch(["cards", toothKey(tooth)]);
  const title = tooth === NO_TOOTH ? row.serviceName : t("Labo:Check:ToothLabel", tooth);
  const done = completedOnText(row);
  const caption = [tooth === NO_TOOTH ? undefined : row.serviceName, done].filter(Boolean).join(" · ");
  const className = ["pd-labo-warranty-tooth", focused && "pd-labo-warranty-tooth--focus"].filter(Boolean).join(" ");

  return (
    <article id={warrantyToothFormId(tooth)} className={className} aria-label={title}>
      <header className="pd-labo-warranty-tooth-head">
        <strong>{title}</strong>
        <span className="pd-labo-warranty-tooth-caption">{caption}</span>
        <LaboWarrantyReadiness card={card} />
      </header>
      <LaboWarrantyCardFields
        path={["cards", toothKey(tooth)]}
        minDay={completedDay(row)}
        serial="none"
        photos={photos}
        photoKey={tooth}
        busy={busy}
        catalogDays={catalogDaysOf(row)}
      />
    </article>
  );
}
