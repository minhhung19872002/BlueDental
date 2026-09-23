import { createContext, useContext, useMemo, useState, type HTMLAttributes } from "react";
import { Button, Select, Table, Tooltip, type TableColumnsType } from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { DataTable } from "@/components/DataTable";
import {
  formatToothCodes,
  type PatientAdviseDto,
} from "@/features/treatment-management/api/consultingApi";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useDragReorder, type DragReorder } from "@/hooks/useDragReorder";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import type { AdviseQuotesState } from "../../hooks/useAdviseQuotes";
import type { PlanVoucherState } from "../../hooks/usePlanVoucher";
import {
  DEFAULT_COLUMN_SETTINGS,
  type ColumnSetting,
  type OptionalColumn,
} from "./adviseColumns";
import { AdviseColumnConfig } from "./AdviseColumnConfig";
import { AdviseQuoteTabs } from "./AdviseQuoteTabs";
import { AdviseVoucherPicker } from "./AdviseVoucherPicker";

/**
 * "Phiếu tư vấn" — the lower card of Chẩn đoán & Tư vấn.
 *
 * Thirteen columns behind a "Cấu hình cột" switch panel, then the plan total
 * of the ticked rows with its voucher line and the four commands the
 * reference ends on.
 */

const money = (value: number) => formatMoneyUnit(value);

/**
 * The drag state has to reach the row component antd builds for us, and antd
 * gives no way to pass props down to it — the same reason Danh mục's
 * `CatalogEntryTable` uses a context here.
 */
const DragContext = createContext<DragReorder<PatientAdviseDto> | null>(null);

function DraggableRow({ children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  const drag = useContext(DragContext);
  const key = (rest as { "data-row-key"?: string })["data-row-key"];

  if (!drag || !key) {
    return <tr {...rest}>{children}</tr>;
  }

  return (
    <tr
      {...rest}
      ref={drag.registerRow(key)}
      className={[rest.className, drag.draggingKey === key && "bd-cat-row--dragging"]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </tr>
  );
}

interface Props {
  rows: PatientAdviseDto[];
  totalCount: number;
  loading: boolean;
  pagination: TablePagination;
  plan: PlanVoucherState;
  dentists: { id: string; name: string }[];
  /** The note of each row's diagnosis slip, by `patientDiagnosisId`. */
  diagnosisNotes: Record<string, string | null>;
  selected: string[];
  onSelect: (ids: string[]) => void;
  /** A row was clicked: open that slip in "Cập nhật phiếu dịch vụ". */
  onEdit?: (row: PatientAdviseDto) => void;
  onDelete?: (row: PatientAdviseDto) => void;
  /** One row moved to a 1-based position across the whole list, not the page. */
  onReorder: (id: string, sortOrder: number) => void | Promise<void>;
  onAddToPlan?: (dentistId: string) => void;
  onPrint?: () => void;
  /** The báo giá tabs beside "Phiếu tư vấn"; owned by the tab, not this card. */
  quotes: AdviseQuotesState;
}

export function PatientAdviseCard({
  rows,
  totalCount,
  loading,
  pagination,
  plan,
  dentists,
  diagnosisNotes,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
  onAddToPlan,
  onPrint,
  quotes,
}: Props) {
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(DEFAULT_COLUMN_SETTINGS);
  const [dentistId, setDentistId] = useState<string>();
  const [dentistError, setDentistError] = useState(false);
  const [confirmQuote, setConfirmQuote] = useState(false);

  const drag = useDragReorder({
    items: rows,
    getKey: (row) => row.id,
    enabled: true,
    // On the plan, `from` indexes the list as it was, so tableRows[from] is the
    // row that moved and `to` is its new slot on this page — SortOrder counts
    // the whole list. A báo giá keeps an order of its own, in the browser.
    onCommit: (from, to) =>
      quotes.active
        ? quotes.move(from, to)
        : onReorder(rows[from].id, pagination.skipCount + to + 1),
  });
  const ordered = drag.items;

  /** Nothing ticked, nothing to price: every command below the table needs a row. */
  const hasTicked = selected.length > 0;
  /** Captured so the copy handler needs no non-null assertion. */
  const openQuote = quotes.active;

  const handleAddToPlan = () => {
    if (!dentistId) {
      setDentistError(true);
      return;
    }
    setDentistError(false);
    onAddToPlan?.(dentistId);
  };

  /** "Có" on the confirmation raises the quote off what is ticked. */
  const handleCreateQuote = () => {
    quotes.create(rows.filter((row) => selected.includes(row.id)));
    setConfirmQuote(false);
  };

  const columns = useMemo<TableColumnsType<PatientAdviseDto>>(() => {
    const all: { key: OptionalColumn; column: TableColumnsType<PatientAdviseDto>[number] }[] = [
      {
        key: "date",
        column: {
          title: t("Patient:Misc:Date"),
          dataIndex: "creationTime",
          width: 110,
          render: formatDate,
        },
      },
      {
        key: "service",
        column: {
          title: t("Common:Service"),
          key: "service",
          width: 210,
          // The reference names the service and nothing else here: the teeth
          // belong with the diagnosis they were charted against, one column on.
          render: (_, row) => <b className="pd-cell-strong">{row.serviceName ?? "—"}</b>,
        },
      },
      {
        key: "diagnosis",
        column: {
          title: t("Patient:Tab:Diagnosis"),
          key: "diagnosis",
          width: 200,
          // "12, 11, 22, 23, 24 - vôi răng": the teeth by number and the
          // diagnosis read as one fact in the reference's link blue. Re-measured
          // on staging 2026-09-22 — the numbers come **without** their surfaces,
          // and a row with no diagnosis prints the teeth alone, no trailing
          // dash. The slip's own note sits under it when it has one.
          render: (_, row) => {
            const note = row.patientDiagnosisId ? diagnosisNotes[row.patientDiagnosisId] : undefined;
            const fact = [formatToothCodes(row.teeth), row.diagnosisName?.trim()]
              .filter(Boolean)
              .join(" - ");
            return (
              <div className="pd-cell-stack">
                <b className="pd-cell-link">{fact || "—"}</b>
                {note && <span>({note})</span>}
              </div>
            );
          },
        },
      },
      {
        key: "staff",
        column: {
          title: t("Patient:Staff:Consultant1"),
          dataIndex: "staffName",
          width: 170,
          render: (value: string | null) => value ?? "—",
        },
      },
      {
        key: "secondStaff",
        column: {
          title: t("Patient:Staff:Consultant2"),
          dataIndex: "secondStaffName",
          width: 170,
          render: (value: string | null) => value ?? "-",
        },
      },
      // The doctors on the chẩn đoán, not the ones who advised — re-measured on
      // staging 2026-09-22: a line with no diagnosis prints "-" in both, even
      // though its own advisor is right there in "Nhân sự tư vấn 1".
      {
        key: "diagnosisStaff",
        column: {
          title: t("Patient:Diagnosis:Doctor1"),
          dataIndex: "diagnosisStaffName",
          width: 170,
          render: (value: string | null) => value ?? "-",
        },
      },
      {
        key: "secondDiagnosis",
        column: {
          title: t("Patient:Diagnosis:Second"),
          dataIndex: "diagnosisSecondStaffName",
          width: 170,
          render: (value: string | null) => value ?? "-",
        },
      },
      {
        key: "quantity",
        column: { title: t("Patient:Payment:Quantity"), dataIndex: "quantity", width: 90, align: "center" },
      },
      {
        key: "price",
        column: {
          title: t("Patient:Payment:UnitPrice"),
          dataIndex: "price",
          width: 140,
          align: "right",
          render: money,
        },
      },
      {
        key: "discount",
        column: {
          title: t("Patient:Payment:Discount"),
          dataIndex: "discountAmount",
          width: 140,
          align: "right",
          render: money,
        },
      },
      {
        key: "amount",
        column: {
          title: t("Patient:Payment:Amount"),
          dataIndex: "effectiveAmount",
          width: 140,
          align: "right",
          render: money,
        },
      },
      {
        key: "note",
        column: {
          title: t("Patient:Advise:Note"),
          dataIndex: "note",
          width: 160,
          render: (value: string | null) => value ?? "—",
        },
      },
    ];

    return [
      {
        key: "grip",
        title: <span className="bd-sr-only">{t("Patient:Misc:Sort")}</span>,
        width: 34,
        align: "center",
        className: "pd-grip-cell",
        // Named before SELECTION_COLUMN below so the grip is the leftmost cell:
        // antd otherwise puts its tick box first, whatever the column order.
        render: (_, row, index) => (
          <button
            type="button"
            title={t("Patient:Misc:DragOrArrowSort")}
            aria-label={t("Patient:SortColumnLabel", row.serviceName ?? row.code)}
            className="bd-grip"
            {...drag.handleProps(row.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" && index > 0) {
                event.preventDefault();
                void onReorder(row.id, pagination.skipCount + index);
              }
              if (event.key === "ArrowDown" && index < ordered.length - 1) {
                event.preventDefault();
                void onReorder(row.id, pagination.skipCount + index + 2);
              }
            }}
          >
            <HolderOutlined aria-hidden="true" />
          </button>
        ),
      },
      Table.SELECTION_COLUMN,
      // The panel's order is the table's order, and only what it leaves on.
      ...columnSettings
        .filter((setting) => setting.on)
        .map((setting) => all.find((entry) => entry.key === setting.key)?.column)
        .filter((column): column is TableColumnsType<PatientAdviseDto>[number] =>
          Boolean(column),
        ),
      ...(onDelete ? [{
        title: t("Common:Actions"),
        key: "actions",
        width: 90,
        align: "center" as const,
        fixed: "right" as const,
        render: (_: unknown, row: PatientAdviseDto) => (
          <Tooltip title={t("Patient:Advise:DeleteService")}>
            <Button
              type="text"
              danger
              aria-label={t("Patient:Advise:DeleteService")}
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row)}
            />
          </Tooltip>
        ),
      }] : []),
    ];
  }, [
    columnSettings,
    onDelete,
    onReorder,
    drag,
    diagnosisNotes,
    ordered.length,
    pagination.skipCount,
  ]);

  return (
    <div className="bd-cat-card pd-advise-card">
      <header className="pd-card-head">
        {/* The reference turns this into a tab strip once a báo giá exists:
            "Phiếu tư vấn" beside "BG 1", "BG 2"… The plan tab only switches
            back to the list; a consulting line is raised from a diagnosis row,
            not from here. */}
        <AdviseQuoteTabs quotes={quotes} />
        <div className="pd-card-note">
          <span>
            {t(
              "Bác sĩ đưa ra các phương pháp can thiệp điều trị. Từ tốt nhất để phù hợp nhất với từng vấn đề đang gặp phải",
            )}
          </span>
        </div>
      </header>

      <div className="pd-advise-tools">
        <AdviseColumnConfig settings={columnSettings} onSave={setColumnSettings} />
      </div>

      <div className="pd-advise-table">
        <DragContext.Provider value={drag}>
          <DataTable<PatientAdviseDto>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={ordered}
            components={{ body: { row: DraggableRow } }}
            rowSelection={{
              selectedRowKeys: selected,
              onChange: (keys) => onSelect(keys as string[]),
            }}
            onRow={onEdit ? (row) => ({
              onClick: (event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (
                  target?.closest("button, a, .ant-checkbox-wrapper, .ant-table-selection-column")
                )
                  return;
                onEdit(row);
              },
            }) : undefined}
            locale={{ emptyText: t("Patient:Plan:Empty") }}
            pagination={
              quotes.active
                ? { pageSize: 20, total: ordered.length, showTotal: countedTotal(t("Patient:Misc:Service")) }
                : pagination.buildConfig(totalCount, countedTotal(t("Patient:Misc:Service")))
            }
          />
        </DragContext.Provider>
      </div>

      {/* The reference keeps this block under a báo giá too, priced on that
          quote's own ticked rows — only the middle command changes. */}
      <footer className="pd-plan-summary">
          <div className="pd-plan-total">
            <strong>{t("Patient:QuoteSheet:PlanTotal")}</strong>

            <p>
              {t("Patient:Payment:GrandTotal")}: <b>{money(plan.gross)}</b>
            </p>

            {/* Every command below prices the ticked rows, so none of them means
              anything until at least one is ticked — the voucher picker
              included: it asks the server what applies to an amount. */}
            <AdviseVoucherPicker plan={plan} disabled={!hasTicked} />

            <p className="pd-plan-net">
              {t("Patient:Payment:TotalAmount")}: <b>{money(plan.net)}</b>
            </p>

            <div className="pd-plan-actions">
              <div className="pd-plan-dentist">
                <Select
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder={t("Patient:Stage:SelectDoctor")}
                  aria-label={t("Patient:Stage:SelectDoctor")}
                  status={dentistError ? "error" : undefined}
                  value={dentistId}
                  onChange={(value) => {
                    setDentistId(value);
                    if (value) setDentistError(false);
                  }}
                  options={dentists.map((dentist) => ({ value: dentist.id, label: dentist.name }))}
                />
                {dentistError && (
                  <span className="pd-plan-dentist-error" role="alert">
                    {t("Patient:Staff:RequiredTreatingDoctor")}
                  </span>
                )}
              </div>
              {onAddToPlan && (
                <Button icon={<PlusOutlined />} disabled={!hasTicked} onClick={handleAddToPlan}>
                  {t("Patient:Plan:Add")}
                </Button>
              )}
              {openQuote ? (
                <Button icon={<CopyOutlined />} onClick={() => quotes.duplicate(openQuote.id)}>
                  {t("Patient:Quote:Copy")}
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!hasTicked}
                  onClick={() => setConfirmQuote(true)}
                >
                  {t("Patient:Quote:Create")}
                </Button>
              )}
              {onPrint && (
                <Tooltip title={t("Patient:Quote:Print")}>
                  <Button
                    className="pd-plan-print"
                    aria-label={t("Patient:Quote:Print")}
                    icon={<PrinterOutlined />}
                    disabled={!hasTicked}
                    onClick={onPrint}
                  />
                </Tooltip>
              )}
            </div>
          </div>
      </footer>

      {/* Worded as the reference words it, doubled "đã chọn" and all — see
          docs/clone/pages/patient-detail.md. */}
      <ConfirmDialog
        open={confirmQuote}
        message={t(
          "Tạo báo giá từ các phiếu tư vấn đã chọn đã chọn, bạn có thể chỉnh sửa ở phần báo giá",
        )}
        onConfirm={handleCreateQuote}
        onClose={() => setConfirmQuote(false)}
      />
    </div>
  );
}
