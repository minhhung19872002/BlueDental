import { Input } from "antd";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import type { WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { toothKey } from "../check/laboCheckRules";
import { LaboWarrantyCardFields } from "./LaboWarrantyCardFields";
import { LaboWarrantyReadiness } from "./LaboWarrantyReadiness";
import { warrantyToothFormId } from "./laboWarrantyRules";
import type { WarrantySharing } from "./useWarrantySharing";

interface Props {
  tooth: LaboOrderToothDto;
  /** "Sứ Zirconia · LABO-202610291"; none when the section's head already names the tooth (R-1152). */
  caption: string | null;
  /** The Ảnh thẻ bảo hành picked so far, keyed by tooth. */
  photos: WarrantyCardDrafts;
  /** Dùng chung on: only the serial is the tooth's own. */
  sharing: WarrantySharing;
  busy: boolean;
  /** Jumped to from its row in 1. Chọn răng kích hoạt. */
  focused: boolean;
}

/** "Sứ Zirconia · LABO-… · Đạt 01/11/2026 09:30". */
export function toothCaption(caption: string, tooth: LaboOrderToothDto): string {
  return [caption, tooth.passedAt && t("Labo:Warranty:PassedOn", formatDateTime(tooth.passedAt))]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 2. One tooth's card: Ngày bắt đầu (not before the day it passed), Mã thẻ
 * hãng, Thời hạn, Điều kiện and the Ảnh thẻ bảo hành — or, with Dùng chung
 * ticked, just its serial, the rest being typed once above.
 */
export function LaboWarrantyToothForm({ tooth, caption, photos, sharing, busy, focused }: Props) {
  const key = toothKey(tooth.toothNumber);
  const label = t("Labo:Check:ToothLabel", tooth.toothNumber);
  const className = [
    "pd-labo-warranty-tooth",
    sharing.on && "pd-labo-warranty-tooth--serial",
    caption == null && "pd-labo-warranty-tooth--bare",
    focused && "pd-labo-warranty-tooth--focus",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article id={warrantyToothFormId(tooth.toothNumber)} className={className} aria-label={label}>
      {caption != null && (
        <header className="pd-labo-warranty-tooth-head">
          <strong>{label}</strong>
          <span className="pd-labo-warranty-tooth-caption">{toothCaption(caption, tooth)}</span>
          <LaboWarrantyReadiness card={sharing.cardOf(tooth.toothNumber)} />
        </header>
      )}
      {sharing.on ? (
        <FloatingField name={["cards", key, "manufacturerSerial"]} label={t("Labo:Warranty:Serial")}>
          <Input maxLength={100} />
        </FloatingField>
      ) : (
        <LaboWarrantyCardFields
          path={["cards", key]}
          minDay={tooth.passedAt ? dayjs(tooth.passedAt).startOf("day") : null}
          serial="own"
          photos={photos}
          photoKey={tooth.toothNumber}
          busy={busy}
        />
      )}
    </article>
  );
}
