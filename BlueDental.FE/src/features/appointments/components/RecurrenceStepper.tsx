import { Button, InputNumber } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  value: number;
  min: number;
  max: number;
  /** Names the number for screen readers, e.g. "Mỗi" or "Sau số lần". */
  label: string;
  onChange: (value: number) => void;
}

/** "[− N +]": a whole number kept within bounds, typed or stepped. */
export function RecurrenceStepper({ value, min, max, label, onChange }: Props) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const handleTyped = (next: number | null) => onChange(clamp(next ?? min));

  return (
    <div className="appt-recur-stepper">
      <Button
        icon={<MinusOutlined />}
        disabled={value <= min}
        aria-label={`${t("Appointment:Series:Decrease")} ${label}`}
        onClick={() => onChange(clamp(value - 1))}
      />
      <InputNumber
        value={value}
        min={min}
        max={max}
        precision={0}
        controls={false}
        aria-label={label}
        onChange={handleTyped}
      />
      <Button
        icon={<PlusOutlined />}
        disabled={value >= max}
        aria-label={`${t("Appointment:Series:Increase")} ${label}`}
        onClick={() => onChange(clamp(value + 1))}
      />
    </div>
  );
}
