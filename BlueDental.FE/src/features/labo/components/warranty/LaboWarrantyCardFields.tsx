import { DatePicker, Form, Input } from "antd";
import type { Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { WarrantyCardPhotos, type WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import { requiredRule } from "../order-dialogs/useLaboOrderForm";
import { LaboWarrantyDurationPicker } from "./LaboWarrantyDurationPicker";
import { warrantyEndDate } from "./laboWarrantyRules";
import type { LaboWarrantyCardValues } from "./useLaboWarrantyForm";

interface Props {
  /** ["cards", "t16"] for a tooth's own card, ["shared"] for Dùng chung. */
  path: string[];
  /** Ngày bắt đầu cannot fall before it: the day the tooth (the latest of them) passed. */
  minDay: Dayjs | null;
  /** Dùng chung: the serial is typed per tooth below, so its box here only says so. */
  serialElsewhere: boolean;
  photos: WarrantyCardDrafts;
  /** The drafts' key of these photos: the tooth, or SHARED_CARD. */
  photoKey: number;
  busy: boolean;
}

/**
 * One card's fields: Ngày bắt đầu, Số serial, Ngày hết hạn (start + Thời hạn),
 * Thời hạn, Điều kiện and the optional Ảnh thẻ bảo hành, front and back
 * (P3110 REQ-E1) — for a tooth's own card and for the shared one alike.
 */
export function LaboWarrantyCardFields({ path, minDay, serialElsewhere, photos, photoKey, busy }: Props) {
  const card: LaboWarrantyCardValues | undefined = Form.useWatch(path);
  const end = warrantyEndDate(card?.startDate, card?.months);

  return (
    <>
      <div className="pd-labo-check-grid pd-labo-check-grid--three">
        <FloatingField
          name={[...path, "startDate"]}
          label={t("Labo:Warranty:StartDate")}
          required
          alwaysFloat
          rules={requiredRule(t("Labo:Warranty:StartDateRequired"))}
        >
          <DatePicker
            format="DD/MM/YYYY"
            placeholder="dd/mm/yyyy"
            className="pd-labo-check-control"
            disabledDate={(day) => Boolean(minDay && day.isBefore(minDay, "day"))}
          />
        </FloatingField>
        {serialElsewhere ? (
          <FloatingField label={t("Labo:Warranty:Serial")} alwaysFloat>
            <Input placeholder={t("Labo:Warranty:SerialElsewhere")} disabled />
          </FloatingField>
        ) : (
          <FloatingField name={[...path, "manufacturerSerial"]} label={t("Labo:Warranty:Serial")}>
            <Input maxLength={100} />
          </FloatingField>
        )}
        <FloatingField label={t("Labo:Warranty:EndDate")} alwaysFloat>
          <Input value={end ? end.format("DD/MM/YYYY") : ""} placeholder={t("Labo:Warranty:EndDatePlaceholder")} disabled />
        </FloatingField>
      </div>
      <div className="pd-labo-warranty-duration-row">
        <span className="pd-labo-warranty-duration-label">
          {t("Labo:Warranty:Duration")} <span className="floating-field-required">*</span>
        </span>
        <Form.Item name={[...path, "months"]} rules={requiredRule(t("Labo:Warranty:DurationRequired"))}>
          <LaboWarrantyDurationPicker />
        </Form.Item>
      </div>
      <FloatingField name={[...path, "conditions"]} label={t("Labo:Warranty:Conditions")}>
        <Input maxLength={1000} />
      </FloatingField>
      <div className="pd-labo-warranty-duration-row">
        <span className="pd-labo-warranty-duration-label">{t("Labo:Warranty:CardPhotos")}</span>
        <WarrantyCardPhotos
          urls={photos.urlsOf(photoKey)}
          disabled={busy}
          onPick={(side, file) => photos.pick(photoKey, side, file)}
          onRemove={(side) => photos.remove(photoKey, side)}
        />
      </div>
    </>
  );
}
