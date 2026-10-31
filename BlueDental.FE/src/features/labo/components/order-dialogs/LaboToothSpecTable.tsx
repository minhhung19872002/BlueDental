import { Checkbox, Form, type CheckboxChangeEvent } from "antd";
import { t } from "@/lib/i18n";
import { specGaps, specRows, toggledSpecRows } from "./laboToothSpecs";
import { LaboToothSpecRow } from "./LaboToothSpecRow";
import { useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";
import "./labo-order-rows.css";

interface Props {
  form: LaboOrderForm;
  busy: boolean;
}

/**
 * Thông số từng răng on the Đặt hàng tab (P3110 m134/m139/m154, REQ-C7/C8):
 * one row per tooth picked, or a single row for all of them once «Dùng chung»
 * is ticked. Rows still lacking Màu răng or Đường hoàn tất read pink with the
 * missing cells red, live (REQ-C9).
 */
export function LaboToothSpecTable({ form, busy }: Props) {
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const shared = useLaboValue(form.form, "sharedSpec") ?? false;
  const values = useLaboValue(form.form, "specs");
  const rows = specRows(teeth, shared);
  const gaps = specGaps(rows, values);

  // The Form.Item already stored sharedSpec; the rows follow it.
  const handleShared = (event: CheckboxChangeEvent) => {
    form.form.setFieldsValue({
      specs: toggledSpecRows(form.form.getFieldValue("specs"), teeth, event.target.checked),
    });
  };

  if (teeth.length === 0) return null;

  return (
    <section className="pd-labo-spec" aria-label={t("Labo:Spec:Title")}>
      <header className="pd-labo-spec-head">
        <div>
          <h4>{t("Labo:Spec:Title")}</h4>
          <p>{t("Labo:Spec:Hint")}</p>
        </div>
        {/* Registered, so the tick lands at once instead of a watch tick later. */}
        <Form.Item name="sharedSpec" valuePropName="checked" noStyle>
          <Checkbox
            className={shared ? "pd-labo-spec-shared pd-labo-spec-shared--on" : "pd-labo-spec-shared"}
            disabled={form.readOnly}
            onChange={handleShared}
          >
            {t("Labo:Spec:Shared")}
          </Checkbox>
        </Form.Item>
      </header>
      <div className="pd-labo-spec-scroll">
        <table className="pd-labo-spec-table">
          <thead>
            <tr>
              <th scope="col">{t("Patient:DentalChart:Tooth")}</th>
              <th scope="col">
                {t("Patient:DentalChart:ToothColor")}
                <span className="floating-field-required">*</span>
              </th>
              <th scope="col">
                {t("Patient:Viewer:CompletedPath")}
                <span className="floating-field-required">*</span>
              </th>
              <th scope="col">{t("Patient:DentalChart:RhythmType")}</th>
              <th scope="col">{t("Patient:DentalChart:Occlusion")}</th>
              <th scope="col">{t("Labo:Spec:Pictures")}</th>
              <th scope="col">{t("Labo:Spec:Note")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <LaboToothSpecRow
                key={row.key}
                row={row}
                gap={gaps.find((gap) => gap.label === row.label)}
                options={form.options}
                pictures={{
                  tiles: form.tilesOf(Number(row.key)),
                  onAdd: (files) => form.addPictures(Number(row.key), files),
                  onRemove: form.removeTile,
                }}
                readOnly={form.readOnly}
                busy={busy}
              />
            ))}
          </tbody>
        </table>
      </div>
      {shared && <p className="pd-labo-spec-caption">{t("Labo:Spec:SharedCaption", teeth.length)}</p>}
    </section>
  );
}
