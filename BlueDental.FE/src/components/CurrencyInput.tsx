import { Input } from "antd";
import type { InputProps } from "antd";
import { NumericFormat } from "react-number-format";
import type { NumericFormatProps } from "react-number-format";

interface CurrencyInputProps
  extends Omit<NumericFormatProps<InputProps>, "value" | "onChange" | "onValueChange" | "customInput"> {
  /** Contract khớp Form.Item: form giữ number, không phải chuỗi đã format. */
  value?: number;
  onChange?: (value: number | undefined) => void;
  /**
   * The most the box will hold. Typing or pasting past it puts the box at
   * exactly this amount instead, so an over-limit figure is never on screen.
   */
  max?: number;
}

/**
 * Input tiền tệ kiểu VN (1.000.000) dựa trên NumericFormat, render bằng AntD
 * Input nên ăn theo style form hiện có. Dùng trong Form.Item/FloatingField
 * như mọi control khác.
 */
/** Ten digits: the largest amount the reference lets anyone type. */
export const MAX_VND = 9_999_999_999;

export function CurrencyInput({ value, onChange, isAllowed, max, ...rest }: CurrencyInputProps) {
  const ceiling = max === undefined ? MAX_VND : Math.min(Math.max(max, 0), MAX_VND);
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
      isAllowed={
        isAllowed ??
        ((values) => {
          if (!values.floatValue || values.floatValue <= ceiling) return true;
          // Refused keystroke: the box settles on the ceiling rather than
          // keeping whatever was there before.
          if (max !== undefined) onChange?.(ceiling);
          return false;
        })
      }
      {...rest}
    />
  );
}
