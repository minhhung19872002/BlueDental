import { useMemo, useState } from "react";
import { Button, Popover, Select, Switch, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, PlusOutlined, PrinterOutlined, SettingOutlined } from "@ant-design/icons";
import { DataTable } from "@/components/DataTable";
import {
  formatTeeth,
  type PatientAdviseDto,
} from "@/features/treatment-management/api/consultingApi";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate, formatVND } from "@/utils/format";
import type { PlanVoucherState } from "../../hooks/usePlanVoucher";
import { AdviseVoucherPicker } from "./AdviseVoucherPicker";

/**
 * "Phiếu tư vấn" — the lower card of Chẩn đoán & Tư vấn.
 *
 * Thirteen columns behind a "Cấu hình cột" switch panel, then the plan total
 * of the ticked rows with its voucher line and the four commands the
 * reference ends on.
 */

/** Every column the reference offers, in its order; `key` doubles as the id. */
const OPTIONAL_COLUMNS = [
  "date",
  "service",
  "diagnosis",
  "staff",
  "secondStaff",
  "diagnosisStaff",
  "secondDiagnosis",
  "quantity",
  "price",
  "discount",
  "amount",
  "note",
] as const;

type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

const COLUMN_LABELS: Record<OptionalColumn, string> = {
  date: "Ngày",
  service: "Dịch vụ",
  diagnosis: "Chẩn đoán",
  staff: "Nhân sự tư vấn 1",
  secondStaff: "Nhân sự tư vấn 2",
  diagnosisStaff: "Bác sĩ chẩn đoán 1",
  secondDiagnosis: "Chẩn đoán 2",
  quantity: "Số lượng",
  price: "Đơn giá",
  discount: "Giảm giá",
  amount: "Thành tiền",
  note: "Ghi chú tư vấn",
};

const money = (value: number) => `${formatVND(value)} đ`;

interface Props {
  rows: PatientAdviseDto[];
  totalCount: number;
  loading: boolean;
  pagination: TablePagination;
  plan: PlanVoucherState;
  dentists: { id: string; name: string }[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  onOpenAdvise: () => void;
  /** A row was clicked: open that slip in "Cập nhật phiếu dịch vụ". */
  onEdit: (row: PatientAdviseDto) => void;
  onDelete: (row: PatientAdviseDto) => void;
  onAddToPlan: (dentistId?: string) => void;
  onQuote: () => void;
  onPrint: () => void;
}

export function PatientAdviseCard({
  rows,
  totalCount,
  loading,
  pagination,
  plan,
  dentists,
  selected,
  onSelect,
  onOpenAdvise,
  onEdit,
  onDelete,
  onAddToPlan,
  onQuote,
  onPrint,
}: Props) {
  const [visible, setVisible] = useState<OptionalColumn[]>([...OPTIONAL_COLUMNS]);
  const [dentistId, setDentistId] = useState<string>();

  const columns = useMemo<TableColumnsType<PatientAdviseDto>>(() => {
    const all: { key: OptionalColumn; column: TableColumnsType<PatientAdviseDto>[number] }[] = [
      {
        key: "date",
        column: {
          title: t("Ngày"),
          dataIndex: "creationTime",
          width: 110,
          render: formatDate,
        },
      },
      {
        key: "service",
        column: {
          title: t("Dịch vụ"),
          key: "service",
          width: 210,
          render: (_, row) => (
            <div className="pd-cell-stack">
              <b>{row.serviceName ?? "—"}</b>
              <span>{formatTeeth(row.teeth)}</span>
            </div>
          ),
        },
      },
      {
        key: "diagnosis",
        column: {
          title: t("Chẩn đoán"),
          dataIndex: "diagnosisName",
          width: 180,
          render: (value: string | null) => value ?? "—",
        },
      },
      {
        key: "staff",
        column: {
          title: t("Nhân sự tư vấn 1"),
          dataIndex: "staffName",
          width: 170,
          render: (value: string | null) => value ?? "—",
        },
      },
      {
        key: "secondStaff",
        column: {
          title: t("Nhân sự tư vấn 2"),
          dataIndex: "secondStaffName",
          width: 170,
          render: (value: string | null) =>
            value ?? <span className="pd-cell-missing">{t("Chưa cập nhật")}</span>,
        },
      },
      {
        key: "diagnosisStaff",
        column: {
          title: t("Bác sĩ chẩn đoán 1"),
          dataIndex: "staffName",
          width: 170,
          render: (value: string | null) => value ?? "—",
        },
      },
      {
        key: "secondDiagnosis",
        column: {
          title: t("Chẩn đoán 2"),
          dataIndex: "diagnosisName",
          width: 170,
          render: (value: string | null) => value ?? "—",
        },
      },
      {
        key: "quantity",
        column: { title: t("Số lượng"), dataIndex: "quantity", width: 90, align: "center" },
      },
      {
        key: "price",
        column: {
          title: t("Đơn giá"),
          dataIndex: "price",
          width: 140,
          align: "right",
          render: money,
        },
      },
      {
        key: "discount",
        column: {
          title: t("Giảm giá"),
          dataIndex: "discountAmount",
          width: 140,
          align: "right",
          render: money,
        },
      },
      {
        key: "amount",
        column: {
          title: t("Thành tiền"),
          dataIndex: "effectiveAmount",
          width: 140,
          align: "right",
          render: money,
        },
      },
      {
        key: "note",
        column: {
          title: t("Ghi chú tư vấn"),
          dataIndex: "note",
          width: 160,
          render: (value: string | null) => value ?? "—",
        },
      },
    ];

    return [
      ...all.filter((entry) => visible.includes(entry.key)).map((entry) => entry.column),
      {
        title: t("Thao tác"),
        key: "actions",
        width: 90,
        align: "center",
        fixed: "right",
        render: (_, row) => (
          <Tooltip title={t("Xoá dịch vụ tư vấn")}>
            <Button
              type="text"
              danger
              aria-label={t("Xoá dịch vụ tư vấn")}
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row)}
            />
          </Tooltip>
        ),
      },
    ];
  }, [visible, onDelete]);

  return (
    <div className="bd-cat-card pd-advise-card">
      <header className="pd-card-head">
        <Button type="primary" onClick={onOpenAdvise}>
          {t("Phiếu tư vấn")}
        </Button>
        <div className="pd-card-note">
          <span>
            {t(
              "Bác sĩ đưa ra các phương pháp can thiệp điều trị. Từ tốt nhất để phù hợp nhất với từng vấn đề đang gặp phải",
            )}
          </span>
        </div>
      </header>

      <div className="pd-advise-tools">
        <Popover
          trigger="click"
          placement="bottomRight"
          title={t("Cấu hình cột")}
          content={
            <div className="pd-column-popover">
              {OPTIONAL_COLUMNS.map((key) => (
                <label key={key}>
                  <span>{t(COLUMN_LABELS[key])}</span>
                  <Switch
                    size="small"
                    checked={visible.includes(key)}
                    onChange={(on) =>
                      setVisible((current) =>
                        on
                          ? OPTIONAL_COLUMNS.filter(
                              (item) => current.includes(item) || item === key,
                            )
                          : current.filter((item) => item !== key),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          }
        >
          <Button icon={<SettingOutlined />}>{t("Cột hiển thị")}</Button>
        </Popover>
      </div>

      <div className="pd-advise-table">
        <DataTable<PatientAdviseDto>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => onSelect(keys as string[]),
          }}
          onRow={(row) => ({
            onClick: (event) => {
              // The checkbox and the action buttons keep their own meaning.
              const target = event.target instanceof Element ? event.target : null;
              if (target?.closest("button, a, .ant-checkbox-wrapper, .ant-table-selection-column"))
                return;
              onEdit(row);
            },
          })}
          locale={{ emptyText: t("Chưa có kế hoạch") }}
          pagination={pagination.buildConfig(totalCount, countedTotal(t("dịch vụ")))}
        />
      </div>

      <footer className="pd-plan-summary">
        <div className="pd-plan-total">
          <strong>{t("TỔNG KẾ HOẠCH")}</strong>

          <p>
            {t("Tổng thành tiền")}: <b>{money(plan.gross)}</b>
          </p>

          <AdviseVoucherPicker plan={plan} />

          <p className="pd-plan-net">
            {t("Tổng tiền")}: <b>{money(plan.net)}</b>
          </p>

          <div className="pd-plan-actions">
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("Chọn bác sĩ điều trị")}
              aria-label={t("Chọn bác sĩ điều trị")}
              value={dentistId}
              onChange={setDentistId}
              options={dentists.map((dentist) => ({ value: dentist.id, label: dentist.name }))}
            />
            <Button
              icon={<PlusOutlined />}
              disabled={selected.length === 0}
              onClick={() => onAddToPlan(dentistId)}
            >
              {t("Thêm kế hoạch điều trị")}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={rows.length === 0}
              onClick={onQuote}
            >
              {t("Tạo báo giá")}
            </Button>
            <Tooltip title={t("In Báo giá")}>
              <Button
                className="pd-plan-print"
                aria-label={t("In Báo giá")}
                icon={<PrinterOutlined />}
                disabled={selected.length === 0}
                onClick={onPrint}
              />
            </Tooltip>
          </div>
        </div>
      </footer>
    </div>
  );
}
