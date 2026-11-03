import { InputNumber } from "antd";
import { Minus, Plus } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  value: number;
  onChange: (value: number) => void;
}

/** "− 1 +" in the Số lượng column of a ticked row (P0111_02, R-1114); one is the floor. */
export function AdviseQtyStepper({ value, onChange }: Props) {
  return (
    <div className="am-stepper">
      <button
        type="button"
        aria-label={t("Treatment:Advise:Decrease")}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus size={12} />
      </button>
      <InputNumber
        aria-label={t("Treatment:Pricing:Quantity")}
        min={1}
        precision={0}
        controls={false}
        value={value}
        onChange={(next) => onChange(next ?? 1)}
      />
      <button type="button" aria-label={t("Treatment:Advise:Increase")} onClick={() => onChange(value + 1)}>
        <Plus size={12} />
      </button>
    </div>
  );
}
