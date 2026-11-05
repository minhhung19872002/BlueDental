import { DatePicker, Form, Input } from "antd";
import type { Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { WarrantyCardPhotos, type WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import { requiredRule } from "../order-dialogs/useLaboOrderForm";
import { LaboWarrantyDurationPicker } from "./LaboWarrantyDurationPicker";
import { cardEndDate } from "./laboWarrantyRules";
import type { LaboWarrantyCardValues } from "./useLaboWarrantyForm";

/**
 * Số serial: typed here (`own`), typed per tooth below under Dùng chung
 * (`elsewhere`), or not on the card at all (`none` — a dental card).
 */
export type WarrantySerialField = "own" | "elsewhere" | "none";

interface Props {
  /** ["cards", "t16"] for a tooth's own card, ["shared"] for Dùng chung. */
  path: string[];
  /** Ngày bắt đầu cannot fall before it: the day the tooth (the latest of them) passed. */
  minDay: Dayjs | null;
  serial: WarrantySerialField;
  photos: WarrantyCardDrafts;
  /** The drafts' key of these photos: the tooth, or SHARED_CARD. */
  photoKey: number;
  busy: boolean;
  /** A dental card's Danh mục days: "Theo danh mục · n ngày" leads the durations (P3110 REQ-B5). */
  catalogDays?: number;
}

function SerialField({ path, serial }: { path: string[]; serial: WarrantySerialField }) {
  if (serial === "none") return null;
  if (serial === "elsewhere") {
    return (
      <FloatingField label={t("Labo:Warranty:Serial")} alwaysFloat>
        <Input placeholder={t("Labo:Warranty:SerialElsewhere")} disabled />
      </FloatingField>
    );
  }
  return (
    <FloatingField name={[...path, "manufacturerSerial"]} label={t("Labo:Warranty:Serial")}>
      <Input maxLength={100} />
    </FloatingField>
  );
}

/**
 * One card's fields: Ngày bắt đầu, Số serial, Ngày hết hạn (start + Thời hạn),
 * Thời hạn, Điều kiện and the optional Ảnh thẻ bảo hành, front and back
 * (P3110 REQ-E1) — for a Labo tooth's card, the shared one, and a dental card.
 */
export function LaboWarrantyCardFields({ path, minDay, serial, photos, photoKey, busy, catalogDays }: Props) {
  const card: LaboWarrantyCardValues | undefined = Form.useWatch(path);
  const end = cardEndDate(card, catalogDays);
  const grid = serial === "none" ? "pd-labo-check-grid--two" : "pd-labo-check-grid--three";

  return (
    <>
      <div className={`pd-labo-check-grid ${grid}`}>
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
        <SerialField path={path} serial={serial} />
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
        <Form.Item name={[...path, "months"]} rules={requiredRule(t("Labo:Warranty:DurationRequired"))}>
          <LaboWarrantyDurationPicker catalogDays={catalogDays} />
        </Form.Item>
      </div>
      <FloatingField name={[...path, "conditions"]} label={t("Labo:Warranty:Conditions")}>
        <Input.TextArea rows={2} maxLength={1000} />
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
