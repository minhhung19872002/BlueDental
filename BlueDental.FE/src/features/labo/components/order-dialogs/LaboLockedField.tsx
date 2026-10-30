import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";

interface Props {
  label: string;
  value: string;
  /** The asterisk; Tên khách hàng above tab 2 goes without, as on the BA's mock. */
  required?: boolean;
}

/**
 * A field of the Labo dialog the user never types into (Tên KH, the known
 * plan and line, Số phiếu, Số lượng). FloatingLabel's label is not tied to the
 * input, so the input carries the same words as its accessible name.
 */
export function LaboLockedField({ label, value, required = true }: Props) {
  return (
    <FloatingLabel label={label} required={required} floated>
      <Input disabled value={value} aria-label={label} />
    </FloatingLabel>
  );
}
