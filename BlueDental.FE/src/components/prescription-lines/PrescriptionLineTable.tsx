import { Button, InputNumber, Select, Table, Tooltip } from "antd";
import { DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { RequiredPlaceholder } from "@/components/RequiredPlaceholder";
import { t } from "@/lib/i18n";
import { doseQuantity, lineFieldLabel, plainDose, RX_SESSIONS, sessionLabel } from "./dose";
import type { MedicineOption, PrescriptionLine } from "./types";
import { UsagePicker } from "./UsagePicker";

interface Props {
  lines: PrescriptionLine[];
  medicines: MedicineOption[];
  onPatch: (line: PrescriptionLine, change: Partial<PrescriptionLine>) => void;
  onRemove: (line: PrescriptionLine) => void;
}

const toNumber = (value: number | string | null) => Number(value) || 0;

/**
 * The medicine lines on a wide screen: Tên thuốc, the four sessions of the
 * day, Số ngày, then Số lượng — never typed, always the sessions × days, so a
 * stored line can never carry a quantity that disagrees with its own dose.
 */
export function PrescriptionLineTable({ lines, medicines, onPatch, onRemove }: Props) {
  const lineNumber = (line: PrescriptionLine) => lines.indexOf(line) + 1;

  const columns: ColumnsType<PrescriptionLine> = [
    {
      key: "medicine",
      title: t("Common:Rx:MedicineName"),
      width: 240,
      // "Tên thuốc*" behind a magnifier: the column name doubles as the
      // required placeholder.
      render: (_, line) => (
        <Select
          showSearch
          optionFilterProp="label"
          className="bd-rx-full"
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
      render: (_: unknown, line: PrescriptionLine) => (
        <InputNumber
          min={0}
          step={0.5}
          formatter={plainDose}
          className="bd-rx-full"
          aria-label={lineFieldLabel(sessionLabel(session), lineNumber(line))}
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
          className="bd-rx-full"
          aria-label={lineFieldLabel(t("Common:Rx:NumberOfDays"), lineNumber(line))}
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
          className="bd-rx-full"
          aria-label={lineFieldLabel(t("Common:Rx:Quantity"), lineNumber(line))}
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
    <Table<PrescriptionLine>
      columns={columns}
      dataSource={lines}
      rowKey={(line) => line.id ?? `new-${lines.indexOf(line)}`}
      pagination={false}
      size="small"
      // Fixed: the columns keep their widths, so a long medicine name or usage
      // ellipsises instead of pushing the table past the dialog.
      tableLayout="fixed"
      scroll={{ x: 960 }}
      className="bd-rx-table"
    />
  );
}
