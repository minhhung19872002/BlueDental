import type { ReactNode } from "react";
import { Input } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { LaboPictureWell } from "./LaboPictureWell";
import { LaboToothRow } from "./LaboToothRow";
import { requiredRule, useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

interface Props {
  form: LaboOrderForm;
  /** The order's Số phiếu, for the tooth chart's title. */
  code: string;
  /** What the tooth row shows in place of the chart button when there is no tooth. */
  emptyTeeth: ReactNode;
  /** While Lưu nháp / Tạo phiếu Labo is uploading. */
  busy: boolean;
}

/**
 * The lower half of the Đặt hàng tab, laid out as the BA's mock (P2910_03,
 * DNBX-99): Răng with its chart button and Số lượng, then Màu răng / Đường hoàn
 * tất / Khớp cắn and Kiểu nhịp — not on the mock, kept rather than dropped —
 * two by two (owner 2026-10-30), the pictures beside their label, and Nội
 * dung the full width at the bottom.
 */
export function LaboOrderFields({ form, code, emptyTeeth, busy }: Props) {
  const { options } = form;
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const quantity = useLaboValue(form.form, "quantity") ?? "";

  return (
    <>
      <LaboToothRow teeth={teeth} quantity={String(quantity)} code={code} empty={emptyTeeth} />

      <div className="pd-labo-specs">
        <FloatingField
          name="shade"
          label={t("Patient:DentalChart:ToothColor")}
          required
          rules={requiredRule(t("Labo:Workflow:RequiredShade"))}
        >
          <Input maxLength={100} />
        </FloatingField>
        <FloatingField name="finishLineId" label={t("Patient:Viewer:CompletedPath")}>
          <SearchSelect allowClear options={options.finishLines} />
        </FloatingField>
        <FloatingField name="biteId" label={t("Patient:DentalChart:Occlusion")}>
          <SearchSelect allowClear options={options.bites} />
        </FloatingField>
        <FloatingField name="rhythmId" label={t("Patient:DentalChart:RhythmType")}>
          <SearchSelect allowClear options={options.rhythms} />
        </FloatingField>
      </div>

      <div className="pd-labo-row">
        <p className="pd-labo-row-label">
          {t("Labo:Workflow:OrderImages")}
          <span className="floating-field-required">*</span>
        </p>
        <LaboPictureWell
          tiles={form.tiles}
          busy={busy}
          readOnly={form.readOnly}
          onAdd={form.addPictures}
          onRemove={form.removeTile}
        />
      </div>

      <div className="pd-labo-notes">
        <FloatingField name="notes" label={t("Labo:Workflow:Instructions")}>
          <Input.TextArea rows={2} maxLength={1000} />
        </FloatingField>
      </div>
    </>
  );
}
