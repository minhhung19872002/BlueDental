import type { ReactNode } from "react";
import { Checkbox, Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboOrderForm } from "./useLaboOrderForm";

interface Props {
  form: LaboOrderForm;
  /** Every tooth the picked line names. */
  teeth: string[];
  /** The ticked ones, handed in by the Form.Item this row sits in. */
  value?: string[];
  /** What stands in for the chips while there is no tooth. */
  empty: ReactNode;
}

/**
 * "Răng:" with "Chọn tất cả" and one chip per tooth, as on the reference; the
 * tick box goes with the chips when the line names none. Shaped as a form
 * control so the Form.Item's rule can paint the label red and print its
 * helper line under the row. Ticks go through the form hook, which keeps Số
 * lượng in step.
 */
export function LaboToothRow({ form, teeth, value = [], empty }: Props) {
  const { status } = Form.Item.useStatus();
  const allTeeth = teeth.length > 0 && value.length === teeth.length;
  const className = ["pd-labo-teeth", status === "error" && "pd-labo-teeth--error"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <p>
        {t("Răng")}:<span className="floating-field-required">*</span>
      </p>
      {teeth.length === 0 ? (
        empty
      ) : (
        <Checkbox checked={allTeeth} onChange={(event) => form.setAllTeeth(event.target.checked)}>
          {t("Chọn tất cả")}
        </Checkbox>
      )}
      <div>
        {teeth.map((label) => (
          <button
            type="button"
            key={label}
            className={value.includes(label) ? "active" : undefined}
            aria-pressed={value.includes(label)}
            onClick={() => form.toggleTooth(label)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
