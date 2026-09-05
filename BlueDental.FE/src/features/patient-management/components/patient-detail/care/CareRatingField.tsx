import type { ReactNode } from "react";
import { Form, Radio } from "antd";
import { t } from "@/lib/i18n";
import { CARE_RATINGS } from "./careRating";

/** "Mức độ hài lòng": four coloured radios laid out as columns. */
export function CareRatingField() {
  return (
    <div className="pc-rating-field">
      <span className="pc-rating-field-label">
        {t("Mức độ hài lòng")}
        <span className="floating-field-required">*</span>
      </span>
      <Form.Item name="outcome" className="pc-rating-item" rules={[{ required: true }]}>
        <Radio.Group className="pc-rating-radios">
          {CARE_RATINGS.map((rating) => (
            <Radio
              key={rating.value}
              value={rating.value}
              className={`pc-rating-radio pc-rating-radio--${rating.tone}`}
            >
              {t(rating.label)}
            </Radio>
          ))}
        </Radio.Group>
      </Form.Item>
    </div>
  );
}

/**
 * A locked field drawn like the floating ones around it: the label sits on
 * the border and the value never changes, so there is nothing to watch.
 */
export function StaticField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="floating-field floating-field--floated pc-static-field">
      {children}
      <label className="floating-field-label">
        {label}
        {required ? <span className="floating-field-required">*</span> : null}
      </label>
    </div>
  );
}
