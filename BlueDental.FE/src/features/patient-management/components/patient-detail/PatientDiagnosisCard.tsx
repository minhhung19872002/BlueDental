import { useRef } from "react";
import { Button, Tooltip, type TableColumnsType } from "antd";
import { CloseOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { CalendarDays } from "lucide-react";
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

/**
 * The form sits under the card's sticky header, so a row further down has
 * scrolled it away: bring the card back to its top, and the card itself into
 * the page's view.
 */
function revealForm(card: HTMLElement | null) {
  if (!card) return;
  card.scrollTo({ top: 0, behavior: "smooth" });
  card.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

interface Props {
  rows: PatientDiagnosisDto[];
  totalCount: number;
  loading: boolean;
  pagination: TablePagination;
  expanded: boolean;
  onToggleForm?: () => void;
  /** A row was clicked: open that slip in the form above, for updating. */
  onEdit?: (row: PatientDiagnosisDto) => void;
  onCreateService?: (row: PatientDiagnosisDto) => void;
  onPrint?: (row: PatientDiagnosisDto) => void;
  onDelete?: (row: PatientDiagnosisDto) => void;
  children?: React.ReactNode;
}

export function PatientDiagnosisCard({
  rows,
  totalCount,
  loading,
  pagination,
  expanded,
  onToggleForm,
  onEdit,
  onCreateService,
  onPrint,
  onDelete,
  children,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleToggleForm = () => {
    onToggleForm?.();
    if (!expanded) revealForm(cardRef.current);
  };
  const columns: TableColumnsType<PatientDiagnosisDto> = [
    {
      title: t("Patient:Payment:SlipNumber"),
      dataIndex: "code",
      width: 130,
      render: (value: string) => <span className="pd-code">{value}</span>,
    },
    {
      title: t("Patient:Diagnosis:Doctor1"),
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
      title: t("Patient:Diagnosis:Second"),
      key: "secondStaff",
      width: 200,
      render: (_, row) => (
        <div className="pd-cell-stack">
          {row.secondStaffName ? (
            <b>{row.secondStaffName}</b>
          ) : (
            <b className="pd-cell-missing">{t("Patient:Diagnosis:NotUpdated")}</b>
          )}
          <span>{formatDate(row.creationTime)}</span>
        </div>
      ),
    },
    {
      title: t("Patient:DentalChart:Tooth"),
      key: "teeth",
      width: 250,
      render: (_, row) => (
        <div className="pd-cell-stack">
          <b className="pd-cell-link">{formatTeeth(row.teeth)}</b>
          <span className="pd-cell-diagnosis">{row.diagnosisName ?? "—"}</span>
        </div>
      ),
    },
    {
      title: t("Common:Note"),
      dataIndex: "note",
      render: (value: string | null) => value ?? "—",
    },
    ...((onCreateService || onPrint || onDelete) ? [{
      title: t("Common:Actions"),
      key: "actions",
      width: 200,
      align: "right" as const,
      fixed: "right" as const,
      render: (_: unknown, row: PatientDiagnosisDto) => (
        <div className="bd-cat-rowactions">
          {onCreateService && (
            <Button type="primary" size="small" onClick={() => onCreateService(row)}>
              {t("Patient:Plan:CreateService")}
            </Button>
          )}
          {onPrint && (
            <Tooltip title={t("Patient:Diagnosis:Print")}>
              <Button
                type="text"
                aria-label={t("Patient:Diagnosis:Print")}
                icon={<CalendarDays size={20} className="pd-print-icon" />}
                onClick={() => onPrint(row)}
              />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title={t("Patient:Diagnosis:Delete")}>
              <Button
                type="text"
                danger
                aria-label={t("Patient:Diagnosis:Delete")}
                icon={<DeleteOutlined />}
                onClick={() => onDelete(row)}
              />
            </Tooltip>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div ref={cardRef} className="bd-cat-card pd-diagnosis-card">
      <header className="pd-card-head">
        <div className="pd-card-title">
          <h3>{t("Patient:Diagnosis:Create")}</h3>
          {onToggleForm && (
            <Button
              type="primary"
              shape="circle"
              aria-label={t("Patient:Diagnosis:Create")}
              aria-expanded={expanded}
              icon={expanded ? <CloseOutlined /> : <PlusOutlined />}
              onClick={handleToggleForm}
            />
          )}
        </div>
        <div className="pd-card-note">
          <b>{t("Patient:QuoteSheet:NotifyDoctor")}</b>
          <span>{t("Patient:Diagnosis:Subtitle")}</span>
        </div>
      </header>

      {children}

      <div className="pd-diagnosis-table">
        <DataTable<PatientDiagnosisDto>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          onRow={onEdit ? (row) => ({
            onClick: (event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (target?.closest("button, a")) return;
              onEdit(row);
              revealForm(cardRef.current);
            },
          }) : undefined}
          locale={{ emptyText: t("Patient:Diagnosis:Empty") }}
          pagination={pagination.buildConfig(totalCount, countedTotal(t("Patient:Misc:Diagnosis")))}
        />
      </div>
    </div>
  );
}
