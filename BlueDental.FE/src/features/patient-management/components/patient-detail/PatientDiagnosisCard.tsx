import { Button, Tooltip, type TableColumnsType } from "antd";
import {
  CalendarOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { DataTable } from "@/components/DataTable";
import {
  formatTeeth,
  type PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate } from "@/utils/format";
import type { TablePagination } from "@/hooks/useTablePagination";

/**
 * "Tạo chẩn đoán" — the right-hand card of Chẩn đoán & Tư vấn.
 *
 * The reference pairs two facts in most cells: a doctor over the date the
 * diagnosis was recorded, the teeth over the diagnosis name. A second doctor
 * that has not been named yet reads "Chưa cập nhật" in red, not a dash.
 */

interface Props {
  rows: PatientDiagnosisDto[];
  totalCount: number;
  loading: boolean;
  pagination: TablePagination;
  expanded: boolean;
  onToggleForm: () => void;
  onCreateService: (row: PatientDiagnosisDto) => void;
  onSchedule: (row: PatientDiagnosisDto) => void;
  onDelete: (row: PatientDiagnosisDto) => void;
  children?: React.ReactNode;
}

export function PatientDiagnosisCard({
  rows,
  totalCount,
  loading,
  pagination,
  expanded,
  onToggleForm,
  onCreateService,
  onSchedule,
  onDelete,
  children,
}: Props) {
  const columns: TableColumnsType<PatientDiagnosisDto> = [
    {
      title: t("Số phiếu"),
      dataIndex: "code",
      width: 130,
      render: (value: string) => <span className="pd-code">{value}</span>,
    },
    {
      title: t("Bác sĩ chẩn đoán 1"),
      key: "staff",
      width: 210,
      render: (_, row) => (
        <div className="pd-cell-stack">
          <b>{row.staffName ?? "—"}</b>
          <span>{formatDate(row.creationTime)}</span>
        </div>
      ),
    },
    {
      title: t("Chẩn đoán 2"),
      key: "secondStaff",
      width: 200,
      render: (_, row) => (
        <div className="pd-cell-stack">
          {row.secondStaffName ? (
            <b>{row.secondStaffName}</b>
          ) : (
            <b className="pd-cell-missing">{t("Chưa cập nhật")}</b>
          )}
          <span>{formatDate(row.creationTime)}</span>
        </div>
      ),
    },
    {
      title: t("Răng"),
      key: "teeth",
      width: 250,
      render: (_, row) => (
        <div className="pd-cell-stack">
          <b className="pd-cell-link">{formatTeeth(row.teeth)}</b>
          <span>{row.diagnosisName ?? "—"}</span>
        </div>
      ),
    },
    {
      title: t("Ghi chú"),
      dataIndex: "note",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 200,
      align: "right",
      fixed: "right",
      render: (_, row) => (
        <div className="bd-cat-rowactions">
          <Button type="primary" size="small" onClick={() => onCreateService(row)}>
            {t("Tạo Dịch Vụ")}
          </Button>
          <Tooltip title={t("Đặt lịch hẹn")}>
            <Button
              type="text"
              aria-label={t("Đặt lịch hẹn")}
              icon={<CalendarOutlined />}
              onClick={() => onSchedule(row)}
            />
          </Tooltip>
          <Tooltip title={t("Xoá chẩn đoán")}>
            <Button
              type="text"
              danger
              aria-label={t("Xoá chẩn đoán")}
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="bd-cat-card pd-diagnosis-card">
      <header className="pd-card-head">
        <div className="pd-card-title">
          <h3>{t("Tạo chẩn đoán")}</h3>
          <Button
            type="primary"
            shape="circle"
            aria-label={t("Tạo chẩn đoán")}
            aria-expanded={expanded}
            icon={expanded ? <CloseOutlined /> : <PlusOutlined />}
            onClick={onToggleForm}
          />
        </div>
        <div className="pd-card-note">
          <b>{t("Bác sĩ có trách nhiệm thông báo")}</b>
          <span>
            {t("Những vấn đề răng miệng đang gặp phải – Hiểu về tiến trình của bệnh lý")}
          </span>
        </div>
      </header>

      {children}

      <DataTable<PatientDiagnosisDto>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: t("Chưa có chẩn đoán") }}
        pagination={pagination.buildConfig(totalCount, countedTotal(t("chẩn đoán")))}
      />
    </div>
  );
}
