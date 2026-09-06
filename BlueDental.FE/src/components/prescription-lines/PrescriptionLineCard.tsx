import { useState } from "react";
import { Button, InputNumber, Select, Tooltip } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { UsagePicker } from "./UsagePicker";
import { lineQuantity, type MedicineOption, type PrescriptionLine } from "./types";

interface Props {
  line: PrescriptionLine;
  index: number;
  medicines: MedicineOption[];
  canDelete: boolean;
  onPatch: (change: Partial<PrescriptionLine>) => void;
  onDelete: () => void;
}

/** One line as a card — the narrow-screen shape of the line table. */
export function PrescriptionLineCard({
  line,
  index,
  medicines,
  canDelete,
  onPatch,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bd-rx-card">
      <div className="bd-rx-card-head">
        <span className="bd-rx-card-num">{index + 1}</span>
        {canDelete && (
          <Tooltip title={t("Xoá dòng")}>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              className="bd-rx-card-del"
              aria-label={t("Xoá dòng thuốc {0}", String(index + 1))}
              onClick={onDelete}
            />
          </Tooltip>
        )}
      </div>
      <div className="bd-rx-card-body">
        <FloatingField label={t("Tên thuốc")}>
          <Select
            showSearch
            optionFilterProp="label"
            className="bd-rx-full"
            placeholder={t("Tên thuốc")}
            value={line.medicineEntryId || undefined}
            onChange={(next) => onPatch({ medicineEntryId: next })}
            options={medicines.map((m) => ({ value: m.id, label: m.name }))}
          />
        </FloatingField>
        <FloatingField label={t("Ngày uống")}>
          <InputNumber
            min={0}
            className="bd-rx-full"
            value={line.timesPerDay}
            onChange={(next) => onPatch({ timesPerDay: Number(next) || 0 })}
          />
        </FloatingField>
        <FloatingField label={t("Mỗi lần")}>
          <InputNumber
            min={0}
            step={0.5}
            className="bd-rx-full"
            value={line.amountPerTime}
            onChange={(next) => onPatch({ amountPerTime: Number(next) || 0 })}
          />
        </FloatingField>
        <FloatingField label={t("Số ngày")}>
          <InputNumber
            min={0}
            className="bd-rx-full"
            value={line.days}
            onChange={(next) => onPatch({ days: Number(next) || 0 })}
          />
        </FloatingField>

        {expanded && (
          <>
            <FloatingField label={t("Số lượng")}>
              <InputNumber disabled className="bd-rx-full" value={lineQuantity(line)} />
            </FloatingField>
            <FloatingField label={t("Sử dụng")}>
              <UsagePicker
                value={{ usage: line.usage, otherUsage: line.otherUsage ?? null }}
                onChange={(next) => onPatch(next)}
              />
            </FloatingField>
          </>
        )}

        <button
          type="button"
          className="bd-rx-card-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t("Rút gọn") : t("Xem thêm")}
          <svg width="12" height="12" viewBox="0 0 12 12" className={expanded ? "bd-rx-flip" : ""}>
            <path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
