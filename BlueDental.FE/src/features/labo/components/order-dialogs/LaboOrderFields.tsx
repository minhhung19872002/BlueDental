import type { ReactNode } from "react";
import { Form, Input } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { isBridge } from "./laboToothSpecs";
import { LaboPictureWell } from "./LaboPictureWell";
import { LaboPriorOrderWarning } from "./LaboPriorOrderWarning";
import { priorGroups, type LaboPriorTeeth } from "./laboPriorTeeth";
import { LaboToothRow } from "./LaboToothRow";
import { LaboToothSpecTable } from "./LaboToothSpecTable";
import { useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";
import "./labo-order-rows.css";

interface Props {
  form: LaboOrderForm;
  /** The order's Số phiếu, for the tooth chart's title. */
  code: string;
  /** What the tooth row shows in place of the chart button when there is no tooth. */
  emptyTeeth: ReactNode;
  /** While Lưu nháp / Gửi Labo is uploading. */
  busy: boolean;
  /** The teeth already on another order of the phiếu điều trị (R-1106). */
  priors: LaboPriorTeeth;
  /** «Xem phiếu ›» on that warning. */
  onViewPrior: (order: LaboOrderDto) => void;
}

/**
 * The lower half of the Đặt hàng tab, laid out as the BA's mock (P3110 m134 /
 * m139): Răng with the teeth picked and Số lượng — warned of a tooth already
 * sent on the slip (P0111_02, R-1106) — Thông số từng răng, the
 * common pictures — none required (REQ-C3) — and Nội dung the full width at
 * the bottom.
 */
export function LaboOrderFields({ form, code, emptyTeeth, busy, priors, onViewPrior }: Props) {
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const shared = useLaboValue(form.form, "sharedSpec") ?? false;
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
          bridge={isBridge(teeth, specs, shared, rhythmName)}
          code={code}
          empty={emptyTeeth}
          readOnly={form.readOnly}
          priors={priors}
          onChange={handleTeethChange}
        />
      </Form.Item>
      <LaboPriorOrderWarning groups={priorGroups(teeth, priors)} onView={onViewPrior} />

      <LaboToothSpecTable form={form} busy={busy} />

      <div className="pd-labo-row pd-labo-row--common">
        <p className="pd-labo-row-label">{t("Labo:Workflow:CommonImages")}</p>
        <LaboPictureWell
          tiles={form.tilesOf("common")}
          busy={busy}
          readOnly={form.readOnly}
          onAdd={(files) => form.addPictures("common", files)}
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
