import { Button, InputNumber, Select } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import { type MedicineOption, UsagePicker } from "@/components/prescription-lines";
import { t } from "@/lib/i18n";
import type { RxMedicineLine } from "../../types/prescription";
import { doseQuantity, plainDose, RX_SESSIONS, sessionLabel } from "../../utils/rxDose";

interface Props {
  line: RxMedicineLine;
  index: number;
  medicines: MedicineOption[];
  canDelete: boolean;
  onPatch: (change: Partial<RxMedicineLine>) => void;
  onDelete: () => void;
}

/** One medicine line as a card — the narrow-screen shape of the line table. */
export function RxMedicineCard({ line, index, medicines, canDelete, onPatch, onDelete }: Props) {
  const number = index + 1;

  return (
    <div className="rx-med-card">
      <div className="rx-med-card-head">
        <span className="rx-med-card-num">{number}</span>
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
          className="rx-full"
          aria-label={t("Common:Rx:MedicineName")}
          notFoundContent={t("Common:Rx:NotFound")}
          value={line.medicineEntryId || undefined}
          onChange={(next) => onPatch({ medicineEntryId: next })}
          options={medicines.map((medicine) => ({ value: medicine.id, label: medicine.name }))}
        />
      </FloatingField>
      <div className="rx-med-card-sessions">
        {RX_SESSIONS.map((session) => (
          <label key={session} className="rx-med-card-session">
            <span>{sessionLabel(session)}</span>
            <InputNumber
              min={0}
              step={0.5}
              formatter={plainDose}
              className="rx-full"
              aria-label={t("Treatment:Rx:SessionOfLine", sessionLabel(session), number)}
              value={line[session]}
              onChange={(next) => onPatch({ [session]: Number(next) || 0 })}
            />
          </label>
        ))}
      </div>
      <div className="rx-med-card-pair">
        <FloatingField label={t("Common:Rx:NumberOfDays")}>
          <InputNumber
            min={0}
            className="rx-full"
            value={line.days}
            onChange={(next) => onPatch({ days: Number(next) || 0 })}
          />
        </FloatingField>
        <FloatingField label={t("Common:Rx:Quantity")}>
          <InputNumber disabled className="rx-full" value={doseQuantity(line)} />
        </FloatingField>
      </div>
      <UsagePicker
        value={{ usage: line.usage, otherUsage: line.otherUsage }}
        onChange={(next) => onPatch(next)}
      />
    </div>
  );
}
