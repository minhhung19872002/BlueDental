import { useState } from "react";
import { Button, InputNumber, Select, Table, Tooltip } from "antd";
import { DeleteOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { RequiredPlaceholder } from "@/components/RequiredPlaceholder";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { t } from "@/lib/i18n";
import { PrescriptionLineCard } from "./PrescriptionLineCard";
import { UsagePicker } from "./UsagePicker";
import {
  EMPTY_PRESCRIPTION_LINE,
  lineQuantity,
  type MedicineOption,
  type PrescriptionLine,
} from "./types";
import "./prescription-lines.css";

/** The page sizes the reference's line table offers, its default first-served. */
const LINE_PAGE_SIZES = [5, 10, 20, 25, 50, 100];
const DEFAULT_LINE_PAGE_SIZE = 20;
/** Below this the table gives way to one card per line; matches the stylesheet. */
const NARROW_SCREEN = "(max-width: 640px)";

interface Props {
  lines: PrescriptionLine[];
  medicines: MedicineOption[];
  onChange: (next: PrescriptionLine[]) => void;
  /**
   * The patient's slip pages its lines (5/10/20… a page, "Hiển thị n trên m");
   * the catalog template lists them all. Off by default.
   */
  paged?: boolean;
}

/**
 * The medicine-line table both the Đơn thuốc mẫu catalog and the patient's
 * Đơn thuốc edit: "Thêm mới" above, then a table on desktop or one card per
 * line on narrow screens — one or the other, never both. "Số lượng" is shown disabled and derived from the three numbers
 * beside it, exactly as the reference does, so a stored line can never carry
 * a quantity that disagrees with its own dose.
 */
export function PrescriptionLineEditor({ lines, medicines, onChange, paged = false }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LINE_PAGE_SIZE);
  const narrow = useMediaQuery(NARROW_SCREEN);

  // Rows are patched by identity: the table hands back the page-relative
  // index, which is the wrong one as soon as a second page exists.
  const patch = (target: PrescriptionLine, change: Partial<PrescriptionLine>) =>
    onChange(lines.map((line) => (line === target ? { ...line, ...change } : line)));
  const remove = (target: PrescriptionLine) => onChange(lines.filter((line) => line !== target));
  const add = () => onChange([...lines, { ...EMPTY_PRESCRIPTION_LINE }]);

  const columns: ColumnsType<PrescriptionLine> = [
    {
      key: "medicine",
      title: t("Common:Rx:MedicineName"),
      width: 260,
      // "Tên thuốc*" behind a magnifier, as the reference draws the picker:
      // the column name doubles as the required placeholder.
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
          onChange={(next) => patch(line, { medicineEntryId: next })}
          options={medicines.map((medicine) => ({ value: medicine.id, label: medicine.name }))}
        />
      ),
    },
    {
      key: "timesPerDay",
      title: t("Common:Rx:TimesPerDay"),
      width: 120,
      render: (_, line) => (
        <InputNumber
          min={0}
          className="bd-rx-full"
          aria-label={t("Common:Rx:TimesPerDay")}
          value={line.timesPerDay}
          onChange={(next) => patch(line, { timesPerDay: Number(next) || 0 })}
        />
      ),
    },
    {
      key: "amountPerTime",
      title: t("Common:Rx:AmountPerTime"),
      width: 110,
      render: (_, line) => (
        <InputNumber
          min={0}
          step={0.5}
          formatter={(v) => v != null ? String(Number(v)) : ""}
          className="bd-rx-full"
          aria-label={t("Common:Rx:AmountPerTime")}
          value={line.amountPerTime}
          onChange={(next) => patch(line, { amountPerTime: Number(next) || 0 })}
        />
      ),
    },
    {
      key: "days",
      title: t("Common:Rx:NumberOfDays"),
      width: 110,
      render: (_, line) => (
        <InputNumber
          min={0}
          className="bd-rx-full"
          aria-label={t("Common:Rx:NumberOfDays")}
          value={line.days}
          onChange={(next) => patch(line, { days: Number(next) || 0 })}
        />
      ),
    },
    {
      key: "quantity",
      title: t("Common:Rx:Quantity"),
      width: 110,
      render: (_, line) => (
        <InputNumber
          disabled
          className="bd-rx-full"
          aria-label={t("Common:Rx:Quantity")}
          value={lineQuantity(line)}
        />
      ),
    },
    {
      key: "usage",
      title: t("Common:Rx:Usage"),
      width: 200,
      render: (_, line) => (
        <UsagePicker
          value={{ usage: line.usage, otherUsage: line.otherUsage ?? null }}
          onChange={(next) => patch(line, next)}
        />
      ),
    },
    {
      key: "remove",
      title: "",
      width: 60,
      align: "center",
      render: (_, line) => (
        <Tooltip title={t("Common:Rx:DeleteLine")}>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            aria-label={t("Common:Rx:DeleteLineN", String(lines.indexOf(line) + 1))}
            disabled={lines.length === 1}
            onClick={() => remove(line)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <div className="bd-row-end bd-mb2">
        <Button className="bd-rx-add" icon={<PlusOutlined />} onClick={add}>
          {t("Common:Add")}
        </Button>
      </div>

      {narrow ? (
        <div className="bd-rx-cards-mobile">
          {lines.map((line, index) => (
            <PrescriptionLineCard
              key={line.id ?? index}
              line={line}
              index={index}
              medicines={medicines}
              canDelete={lines.length > 1}
              onPatch={(change) => patch(line, change)}
              onDelete={() => remove(line)}
            />
          ))}
        </div>
      ) : (
        <div className="bd-rx-table-desktop">
          <Table<PrescriptionLine>
            columns={columns}
            dataSource={lines}
            rowKey={(line) => line.id ?? String(lines.indexOf(line))}
            pagination={
              paged
                ? {
                    current: page,
                    pageSize,
                    total: lines.length,
                    showSizeChanger: true,
                    pageSizeOptions: LINE_PAGE_SIZES,
                    onChange: (nextPage, nextSize) => {
                      setPage(nextSize === pageSize ? nextPage : 1);
                      setPageSize(nextSize);
                    },
                    showTotal: (total, range) =>
                      t("Common:PaginationShort", total === 0 ? 0 : range[1] - range[0] + 1, total),
                  }
                : false
            }
            size="small"
            className="bd-line-table"
          />
        </div>
      )}
    </>
  );
}
