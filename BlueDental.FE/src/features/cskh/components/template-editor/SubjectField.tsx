import { Input } from "antd";
import { t } from "@/lib/i18n";
import { MESSAGE_TEMPLATE_LIMITS } from "../../api/templateApi";
import type { CaretField } from "../../hooks/useCaretField";

interface SubjectFieldProps {
  value: string;
  field: CaretField;
  readOnly: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
}

/** Tiêu đề email — required by Lưu mẫu; inbox lists cut it near 60 characters. */
export function SubjectField({ value, field, readOnly, onChange, onFocus }: SubjectFieldProps) {
  return (
    <div className="tpe-field">
      <label className="tpe-label tpe-label--required" htmlFor="tpe-subject">
        {t("CSKH:Template:Subject")}
      </label>
      <Input
        id="tpe-subject"
        ref={(ref) => {
          field.element.current = ref?.input ?? null;
        }}
        value={value}
        readOnly={readOnly}
        maxLength={MESSAGE_TEMPLATE_LIMITS.subject}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
      />
      <span className="tpe-hint">{t("CSKH:Template:SubjectCounter", value.length)}</span>
    </div>
  );
}
