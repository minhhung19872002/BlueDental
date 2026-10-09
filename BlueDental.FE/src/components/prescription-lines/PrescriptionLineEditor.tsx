import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { appendEmptyLine, PrescriptionLineList } from "./PrescriptionLineList";
import type { MedicineOption, PrescriptionLine } from "./types";

interface Props {
  lines: PrescriptionLine[];
  medicines: MedicineOption[];
  onChange: (next: PrescriptionLine[]) => void;
}

/**
 * The Đơn thuốc mẫu catalog's line editor: "Thêm mới" above the same line
 * table the patient's Đơn thuốc uses — Sáng / Trưa / Chiều / Tối, Số ngày,
 * Số lượng, Sử dụng (R-884).
 */
export function PrescriptionLineEditor({ lines, medicines, onChange }: Props) {
  const handleAdd = () => onChange(appendEmptyLine(lines));

  return (
    <>
      <div className="bd-row-end bd-mb2">
        <Button className="bd-rx-add" icon={<PlusOutlined />} onClick={handleAdd}>
          {t("Common:Add")}
        </Button>
      </div>
      <PrescriptionLineList lines={lines} medicines={medicines} onChange={onChange} />
    </>
  );
}
