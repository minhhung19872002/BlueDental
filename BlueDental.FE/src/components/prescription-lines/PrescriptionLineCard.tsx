import { Button, InputNumber, Select } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { doseQuantity, lineFieldLabel, plainDose, RX_SESSIONS, sessionLabel } from "./dose";
import type { MedicineOption, PrescriptionLine } from "./types";
import { UsagePicker } from "./UsagePicker";

interface Props {
  line: PrescriptionLine;
  index: number;
  medicines: MedicineOption[];
  canDelete: boolean;
  onPatch: (change: Partial<PrescriptionLine>) => void;
  onDelete: () => void;
}

/** One medicine line as a card — the narrow-screen shape of the line table. */
export function PrescriptionLineCard({ line, index, medicines, canDelete, onPatch, onDelete }: Props) {
  const number = index + 1;

  return (
    <div className="bd-rx-card">
      <div className="bd-rx-card-head">
        <span className="bd-rx-card-num">{number}</span>
        {canDelete && (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            aria-label={t("Common:Rx:DeleteLineN", String(number))}
            onClick={onDelete}
          />
        )}
      </div>
      <FloatingField label={t("Common:Rx:MedicineName")} required>
        <Select
          showSearch
          optionFilterProp="label"
          className="bd-rx-full"
          aria-label={t("Common:Rx:MedicineName")}
          notFoundContent={t("Common:Rx:NotFound")}
          value={line.medicineEntryId || undefined}
          onChange={(next) => onPatch({ medicineEntryId: next })}
          options={medicines.map((medicine) => ({ value: medicine.id, label: medicine.name }))}
        />
      </FloatingField>
      <div className="bd-rx-card-sessions">
        {RX_SESSIONS.map((session) => (
          <label key={session} className="bd-rx-card-session">
            <span>{sessionLabel(session)}</span>
            <InputNumber
              min={0}
              step={0.5}
              formatter={plainDose}
              className="bd-rx-full"
              aria-label={lineFieldLabel(sessionLabel(session), number)}
              value={line[session]}
              onChange={(next) => onPatch({ [session]: Number(next) || 0 })}
            />
          </label>
        ))}
      </div>
      <div className="bd-rx-card-pair">
        <FloatingField label={t("Common:Rx:NumberOfDays")}>
          <InputNumber
            min={0}
            className="bd-rx-full"
            value={line.days}
            onChange={(next) => onPatch({ days: Number(next) || 0 })}
          />
        </FloatingField>
        <FloatingField label={t("Common:Rx:Quantity")}>
          <InputNumber disabled className="bd-rx-full" value={doseQuantity(line)} />
        </FloatingField>
      </div>
      <UsagePicker
        value={{ usage: line.usage, otherUsage: line.otherUsage }}
        onChange={(next) => onPatch(next)}
      />
    </div>
  );
}
