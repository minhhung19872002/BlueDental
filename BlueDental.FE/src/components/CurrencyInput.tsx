import { Input } from "antd";
import type { InputProps } from "antd";
import { NumericFormat } from "react-number-format";
import type { NumericFormatProps } from "react-number-format";

interface CurrencyInputProps
  extends Omit<NumericFormatProps<InputProps>, "value" | "onChange" | "onValueChange" | "customInput"> {
  /** Contract khớp Form.Item: form giữ number, không phải chuỗi đã format. */
  value?: number;
  onChange?: (value: number | undefined) => void;
}

/**
 * Input tiền tệ kiểu VN (1.000.000) dựa trên NumericFormat, render bằng AntD
 * Input nên ăn theo style form hiện có. Dùng trong Form.Item/FloatingField
 * như mọi control khác.
 */
const MAX_VND = 9_999_999_999;

export function CurrencyInput({ value, onChange, isAllowed, ...rest }: CurrencyInputProps) {
  return (
    <NumericFormat
      customInput={Input}
      value={value ?? ""}
      onValueChange={(values, sourceInfo) => {
        if (sourceInfo.source === "event") onChange?.(values.floatValue);
      }}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={0}
      allowNegative={false}
      isAllowed={isAllowed ?? ((values) => !values.floatValue || values.floatValue <= MAX_VND)}
      {...rest}
    />
  );
}
