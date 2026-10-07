import { Button, InputNumber, Select, Table, Tooltip } from "antd";
import { DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { type MedicineOption, UsagePicker } from "@/components/prescription-lines";
import { RequiredPlaceholder } from "@/components/RequiredPlaceholder";
import { t } from "@/lib/i18n";
import type { RxMedicineLine } from "../../types/prescription";
import { doseQuantity, plainDose, RX_SESSIONS, sessionLabel } from "../../utils/rxDose";

export interface RxLineEditing {
  lines: RxMedicineLine[];
  medicines: MedicineOption[];
  onPatch: (line: RxMedicineLine, change: Partial<RxMedicineLine>) => void;
  onRemove: (line: RxMedicineLine) => void;
}

const toNumber = (value: number | string | null) => Number(value) || 0;

/**
 * The medicine lines on a wide screen: Tên thuốc, the four sessions of the
 * day, Số ngày, then Số lượng — never typed, always the sessions × days (F-58).
 */
export function RxMedicineTable({ lines, medicines, onPatch, onRemove }: RxLineEditing) {
  const lineNumber = (line: RxMedicineLine) => lines.indexOf(line) + 1;

  const columns: ColumnsType<RxMedicineLine> = [
    {
      key: "medicine",
      title: t("Common:Rx:MedicineName"),
      width: 240,
      render: (_, line) => (
        <Select
          showSearch
          optionFilterProp="label"
          className="rx-full"
          aria-label={t("Common:Rx:MedicineName")}
          placeholder={<RequiredPlaceholder text={t("Common:Rx:MedicineName")} />}
          prefix={<SearchOutlined />}
          notFoundContent={t("Common:Rx:NotFound")}
          value={line.medicineEntryId || undefined}
          onChange={(next) => onPatch(line, { medicineEntryId: next })}
          options={medicines.map((medicine) => ({ value: medicine.id, label: medicine.name }))}
        />
      ),
    },
    ...RX_SESSIONS.map((session) => ({
      key: session,
      title: sessionLabel(session),
      width: 76,
      render: (_: unknown, line: RxMedicineLine) => (
        <InputNumber
          min={0}
          step={0.5}
          formatter={plainDose}
          className="rx-full"
          aria-label={t("Treatment:Rx:SessionOfLine", sessionLabel(session), lineNumber(line))}
          value={line[session]}
          onChange={(next) => onPatch(line, { [session]: toNumber(next) })}
        />
      ),
    })),
    {
      key: "days",
      title: t("Common:Rx:NumberOfDays"),
      width: 86,
      render: (_, line) => (
        <InputNumber
          min={0}
          className="rx-full"
          aria-label={t("Treatment:Rx:SessionOfLine", t("Common:Rx:NumberOfDays"), lineNumber(line))}
          value={line.days}
          onChange={(next) => onPatch(line, { days: toNumber(next) })}
        />
      ),
    },
    {
      key: "quantity",
      title: t("Common:Rx:Quantity"),
      width: 90,
      render: (_, line) => (
        <InputNumber
          disabled
          className="rx-full"
          aria-label={t("Treatment:Rx:SessionOfLine", t("Common:Rx:Quantity"), lineNumber(line))}
          value={doseQuantity(line)}
        />
      ),
    },
    {
      key: "usage",
      title: t("Common:Rx:Usage"),
      width: 180,
      render: (_, line) => (
        <UsagePicker
          value={{ usage: line.usage, otherUsage: line.otherUsage }}
          onChange={(next) => onPatch(line, next)}
        />
      ),
    },
    {
      key: "remove",
      title: "",
      width: 48,
      align: "center",
      render: (_, line) => (
        <Tooltip title={t("Common:Rx:DeleteLine")}>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            aria-label={t("Common:Rx:DeleteLineN", String(lineNumber(line)))}
            disabled={lines.length === 1}
            onClick={() => onRemove(line)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Table<RxMedicineLine>
      columns={columns}
      dataSource={lines}
      rowKey={(line) => line.id ?? `new-${lines.indexOf(line)}`}
      pagination={false}
      size="small"
      scroll={{ x: 960 }}
      className="rx-med-table"
    />
  );
}
