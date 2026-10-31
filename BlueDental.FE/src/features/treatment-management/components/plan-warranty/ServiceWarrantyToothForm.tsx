import { DatePicker, Form, Input } from "antd";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { StatusBadge } from "@/components/StatusBadge";
import { WarrantyCardPhotos, type WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { LABO_PILL_TONE } from "@/features/labo/api/laboStatus";
import { requiredRule } from "@/features/labo/components/order-dialogs/useLaboOrderForm";
import { LaboWarrantyDurationPicker } from "@/features/labo/components/warranty/LaboWarrantyDurationPicker";
import { t } from "@/lib/i18n";
import type { WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { cardKey, serviceCardEnd, type ServiceWarrantyCardValues } from "./useServiceWarrantyForm";

interface Props {
  /** 0 on a line without teeth. */
  tooth: number;
  row: WarrantyServiceRowDto;
  photos: WarrantyCardDrafts;
  busy: boolean;
}

/** Thiếu ngày bắt đầu, thời hạn — or Đủ thông tin once both are in. */
function Readiness({ card }: { card: ServiceWarrantyCardValues | undefined }) {
  const missing = [
    !card?.startDate && t("Labo:Warranty:StartDateShort"),
    card?.months === undefined && t("Labo:Warranty:DurationShort"),
  ].filter((part): part is string => Boolean(part));
  if (missing.length === 0) {
    return <StatusBadge label={t("Labo:Warranty:Ready")} {...LABO_PILL_TONE.success} />;
  }
  return <StatusBadge label={t("Labo:Warranty:Missing", missing.join(", "))} {...LABO_PILL_TONE.warning} />;
}

/**
 * One dental card (REQ-B5), on the frame of the Labo card form: Ngày bắt đầu
 * (not before the line was finished), Thời hạn — "Theo danh mục" first —,
 * Ngày hết hạn worked out, Điều kiện and the optional photos. No serial.
 */
export function ServiceWarrantyToothForm({ tooth, row, photos, busy }: Props) {
  const key = cardKey(tooth);
  const card: ServiceWarrantyCardValues | undefined = Form.useWatch(["cards", key]);
  const end = serviceCardEnd(card, row.warrantyDays);
  const doneDay = row.completedOn ? dayjs(row.completedOn) : null;
  const title = tooth ? t("Labo:Check:ToothLabel", tooth) : row.serviceName;

  return (
    <article className="pd-labo-warranty-tooth" aria-label={title}>
      <header className="pd-labo-warranty-tooth-head">
        <strong>{title}</strong>
        <span className="pd-labo-warranty-tooth-caption">{tooth ? row.serviceName : ""}</span>
        <Readiness card={card} />
      </header>
      <div className="pd-labo-check-grid pd-labo-check-grid--two">
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
            disabledDate={(day) => Boolean(doneDay && day.isBefore(doneDay, "day"))}
          />
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
          <LaboWarrantyDurationPicker catalogDays={row.warrantyDays > 0 ? row.warrantyDays : undefined} />
        </Form.Item>
      </div>
      <FloatingField name={["cards", key, "conditions"]} label={t("Labo:Warranty:Conditions")}>
        <Input maxLength={1000} />
      </FloatingField>
      <div className="pd-labo-warranty-duration-row">
        <span className="pd-labo-warranty-duration-label">{t("Labo:Warranty:CardPhotos")}</span>
        <WarrantyCardPhotos
          urls={photos.urlsOf(tooth)}
          disabled={busy}
          onPick={(side, file) => photos.pick(tooth, side, file)}
          onRemove={(side) => photos.remove(tooth, side)}
        />
      </div>
    </article>
  );
}
