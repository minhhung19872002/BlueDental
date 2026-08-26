import { useMemo } from "react";
import type { ColumnsType } from "antd/es/table";
import { useUntreatedDiagnoses, type UntreatedDiagnosisRow } from "../api/operationReportApi";
import { operationsTotal } from "../operationsTotal";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { usePeriodRange } from "./usePeriodRange";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";

/**
 * Quản trị vận hành → Chẩn đoán chưa điều trị.
 *
 * Diagnoses that never became a treatment line — the list a clinic works
 * through to find business it has already found and not followed up.
 */
export function UntreatedDiagnosisReport() {
  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);

  const query = useUntreatedDiagnoses({
    periodCode: range.periodCode,
    anchorIso: range.anchorIso,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const columns = useMemo<ColumnsType<UntreatedDiagnosisRow>>(
    () => [
      {
        key: "date",
        title: t("Ngày"),
        width: 140,
        render: (_, row) => <span className="bd-cat-num">{formatDate(row.diagnosedAt)}</span>,
      },
      {
        key: "patient",
        title: t("Khách hàng"),
        render: (_, row) => (
          <span className="bd-ops-patient">
            <span className="bd-ops-patient-name">
              [{row.patientCode}] - {row.patientName}
            </span>
          </span>
        ),
      },
      { key: "staff", title: t("Nhân sự"), dataIndex: "staffName", width: 180 },
      { key: "teeth", title: t("Răng"), dataIndex: "teeth", width: 110 },
      { key: "diagnosis", title: t("Chẩn đoán"), dataIndex: "diagnosisName", width: 220 },
      {
        key: "note",
        title: t("Nội dung / Ghi chú"),
        render: (_, row) => row.note ?? "—",
      },
    ],
    [],
  );

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} />
      </div>

      <div className="bd-cat-card">
        <DataTable<UntreatedDiagnosisRow>
          columns={columns}
          dataSource={query.data?.items ?? []}
          rowKey={(row) => `${row.diagnosedAt}-${row.patientCode}-${row.diagnosisName}`}
          loading={query.isFetching}
          pagination={pagination.buildConfig(query.data?.totalCount ?? 0, operationsTotal)}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </div>
  );
}
