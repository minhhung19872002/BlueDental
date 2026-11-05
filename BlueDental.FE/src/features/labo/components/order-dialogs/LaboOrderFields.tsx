import type { ReactNode } from "react";
import { Form, Input } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { DEFAULT_SPEC_MODE, isBridge } from "./laboToothSpecs";
import { LaboPictureWell } from "./LaboPictureWell";
import { LaboPriorOrderWarning } from "./LaboPriorOrderWarning";
import { priorGroups, type LaboPriorTeeth } from "./laboPriorTeeth";
import { LaboToothRow } from "./LaboToothRow";
import { LaboToothSpecTable } from "./LaboToothSpecTable";
import { useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";
import "./labo-order-rows.css";

interface TeethProps {
  form: LaboOrderForm;
  /** The order's Số phiếu, for the tooth chart's title. */
  code: string;
  /** What the tooth row shows in place of the chart button when there is no tooth. */
  emptyTeeth: ReactNode;
  /** The teeth already on another order of the phiếu điều trị (R-1106). */
  priors: LaboPriorTeeth;
  /** «Xem phiếu ›» on that warning. */
  onViewPrior: (order: LaboOrderDto) => void;
}

/**
 * Răng on the Đặt hàng tab (P3110 m134 / m139): the teeth picked and Số
 * lượng, warned of a tooth already sent on the slip (P0111_02, R-1106). It
 * closes the "Thông tin phiếu" column of the Labo 1 mock.
 */
export function LaboTeethField({ form, code, emptyTeeth, priors, onViewPrior }: TeethProps) {
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const mode = useLaboValue(form.form, "specMode") ?? DEFAULT_SPEC_MODE;
  const specs = useLaboValue(form.form, "specs");
  const rhythmName = (id: string) => form.options.rhythms.find((rhythm) => rhythm.value === id)?.label ?? "";

  // Runs after the Form.Item stored the teeth: Số lượng is the number picked.
  const handleTeethChange = (picked: string[]) => form.form.setFieldsValue({ quantity: String(picked.length) });

  return (
    <>
      <Form.Item
        name="teeth"
        rules={[{ type: "array", min: 1, message: t("Treatment:Tooth:ToothRequired") }]}
      >
        <LaboToothRow
          bridge={isBridge(teeth, specs, mode, rhythmName)}
          code={code}
          empty={emptyTeeth}
          readOnly={form.readOnly}
          priors={priors}
          onChange={handleTeethChange}
        />
      </Form.Item>
      <LaboPriorOrderWarning groups={priorGroups(teeth, priors)} onView={onViewPrior} />
    </>
  );
}

interface SpecsProps {
  form: LaboOrderForm;
  /** While Lưu nháp / Gửi Labo is uploading. */
  busy: boolean;
  /** The teeth already on another order of the slip: their cards wear the orange dot. */
  priors: LaboPriorTeeth;
}

/**
 * The right column of the Labo v2 mock: Thông số từng răng, then Nội dung
 * beside the common pictures — the only pictures an order takes now (R-1150).
 */
export function LaboOrderSpecs({ form, busy, priors }: SpecsProps) {
  return (
    <>
      <LaboToothSpecTable form={form} priors={priors} />

      <div className="pd-labo-extras">
        <div className="pd-labo-notes">
          <FloatingField name="notes" label={t("Labo:Workflow:Instructions")}>
            <Input.TextArea rows={5} maxLength={1000} />
          </FloatingField>
        </div>
        <div className="pd-labo-row pd-labo-row--common">
          <p className="pd-labo-row-label">
            {t("Labo:Workflow:CommonImages")} <span className="pd-labo-row-hint">{t("Labo:Workflow:CommonImagesHint")}</span>
          </p>
          <LaboPictureWell
            tiles={form.tilesOf("common")}
            busy={busy}
            readOnly={form.readOnly}
            onAdd={(files) => form.addPictures("common", files)}
            onRemove={form.removeTile}
          />
        </div>
      </div>
    </>
  );
}
