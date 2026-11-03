import { DatePicker, Form, Input } from "antd";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { WarrantyCardPhotos, type WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { toothKey } from "../check/laboCheckRules";
import { requiredRule } from "../order-dialogs/useLaboOrderForm";
import { LaboWarrantyDurationPicker } from "./LaboWarrantyDurationPicker";
import { LaboWarrantyReadiness } from "./LaboWarrantyReadiness";
import { warrantyEndDate, warrantyToothFormId } from "./laboWarrantyRules";
import type { LaboWarrantyCardValues } from "./useLaboWarrantyForm";

interface Props {
  tooth: LaboOrderToothDto;
  /** "Sứ Zirconia · LABO-202610291". */
  caption: string;
  /** The Ảnh thẻ bảo hành picked so far, keyed by tooth. */
  photos: WarrantyCardDrafts;
  busy: boolean;
  /** Jumped to from its row in 1. Chọn răng kích hoạt. */
  focused: boolean;
}

/**
 * 2. One tooth's card: Ngày bắt đầu (not before the day it passed), Mã thẻ
 * hãng, Thời hạn — Ngày hết hạn follows from the two — Điều kiện and the
 * optional Ảnh thẻ bảo hành, front and back (P3110 REQ-E1).
 */
export function LaboWarrantyToothForm({ tooth, caption, photos, busy, focused }: Props) {
  const key = toothKey(tooth.toothNumber);
  const card: LaboWarrantyCardValues | undefined = Form.useWatch(["cards", key]);
  const end = warrantyEndDate(card?.startDate, card?.months);
  const passedDay = tooth.passedAt ? dayjs(tooth.passedAt).startOf("day") : null;

  return (
    <article
      id={warrantyToothFormId(tooth.toothNumber)}
      className={["pd-labo-warranty-tooth", focused && "pd-labo-warranty-tooth--focus"].filter(Boolean).join(" ")}
      aria-label={t("Labo:Check:ToothLabel", tooth.toothNumber)}
    >
      <header className="pd-labo-warranty-tooth-head">
        <strong>{t("Labo:Check:ToothLabel", tooth.toothNumber)}</strong>
        <span className="pd-labo-warranty-tooth-caption">
          {[caption, tooth.passedAt && t("Labo:Warranty:PassedOn", formatDateTime(tooth.passedAt))]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <LaboWarrantyReadiness card={card} />
      </header>
      <div className="pd-labo-check-grid pd-labo-check-grid--three">
        <FloatingField
          name={["cards", key, "startDate"]}
          label={t("Labo:Warranty:StartDate")}
          required
          alwaysFloat
          rules={requiredRule(t("Labo:Warranty:StartDateRequired"))}
        >
          <DatePicker
            format="DD/MM/YYYY"
            placeholder="dd/mm/yyyy"
            className="pd-labo-check-control"
            disabledDate={(day) => Boolean(passedDay && day.isBefore(passedDay, "day"))}
          />
        </FloatingField>
        <FloatingField name={["cards", key, "manufacturerSerial"]} label={t("Labo:Warranty:Serial")}>
          <Input maxLength={100} />
        </FloatingField>
        <FloatingField label={t("Labo:Warranty:EndDate")} alwaysFloat>
          <Input
            value={end ? end.format("DD/MM/YYYY") : ""}
            placeholder={t("Labo:Warranty:EndDatePlaceholder")}
            disabled
          />
        </FloatingField>
      </div>
      <div className="pd-labo-warranty-duration-row">
        <span className="pd-labo-warranty-duration-label">
          {t("Labo:Warranty:Duration")} <span className="floating-field-required">*</span>
        </span>
        <Form.Item name={["cards", key, "months"]} rules={requiredRule(t("Labo:Warranty:DurationRequired"))}>
          <LaboWarrantyDurationPicker />
        </Form.Item>
      </div>
      <FloatingField name={["cards", key, "conditions"]} label={t("Labo:Warranty:Conditions")}>
        <Input maxLength={1000} />
      </FloatingField>
      <div className="pd-labo-warranty-duration-row">
        <span className="pd-labo-warranty-duration-label">{t("Labo:Warranty:CardPhotos")}</span>
        <WarrantyCardPhotos
          urls={photos.urlsOf(tooth.toothNumber)}
          disabled={busy}
          onPick={(side, file) => photos.pick(tooth.toothNumber, side, file)}
          onRemove={(side) => photos.remove(tooth.toothNumber, side)}
        />
      </div>
    </article>
  );
}
