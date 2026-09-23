import { Pagination, type TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import { RecordCard } from "@/components/RecordCard";
import {
  debtMovementLabels,
  usePatientDebtHistory,
  type DebtHistoryEntryDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDateTime } from "@/utils/format";
import { DebtAmount, dashOrValue, debtCardRows } from "./debtHistoryRows";

/** The reference folds this table into cards below 769px, not 640. */
const NARROW_SCREEN = "(max-width: 768px)";

function buildColumns(): TableColumnsType<DebtHistoryEntryDto> {
  const labels = debtMovementLabels();
  return [
    {
      key: "date",
      title: t("Patient:Payment:TransactionDate"),
      width: 160,
      render: (_, entry) => formatDateTime(entry.date),
    },
    { key: "type", title: t("Patient:Plan:Type"), width: 160, render: (_, entry) => labels[entry.type] },
    {
      key: "amount",
      title: t("Patient:Payment:AmountField"),
      width: 140,
      render: (_, entry) => <DebtAmount entry={entry} />,
    },
    {
      key: "staff",
      title: t("Patient:Col:Staff"),
      width: 140,
      render: (_, entry) => dashOrValue(entry.staffName),
    },
    {
      key: "note",
      title: t("Patient:Debt:Note"),
      width: 200,
      render: (_, entry) => dashOrValue(entry.note),
    },
  ];
}

/**
 * Tab "Lịch sử dư nợ": every movement on the patient's account, newest first.
 * Five columns, no toolbar and no column picker — measured on the reference
 * 2026-09-22, see docs/clone/pages/patient-detail.md.
 */
export function PatientDebtTab({ patientId }: { patientId: string }) {
  const branchId = useCurrentBranchId();
  const narrow = useMediaQuery(NARROW_SCREEN);
  const pagination = useTablePagination(20);
  const query = usePatientDebtHistory(patientId, branchId, {
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.totalCount ?? 0;
  const showTotal = countedTotal(t("Patient:Debt:Transaction"));

  if (narrow) {
    return (
      <section className="pd-pane pd-pane--fill">
        <div className="tp-card-list">
          {rows.length === 0 && !query.isLoading && (
            <p className="bd-rc-empty">{t("Patient:Debt:Empty")}</p>
          )}
          <div className="bd-rc-list">
            {rows.map((entry, position) => {
              const card = debtCardRows(entry);
              return (
                <RecordCard
                  key={entry.id}
                  title={String(pagination.skipCount + position + 1)}
                  rows={card.rows}
                  moreRows={card.moreRows}
                />
              );
            })}
          </div>
          <div className="tp-card-pager">
            <Pagination {...pagination.buildConfig(total, showTotal)} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pd-pane pd-pane--fill">
      <div className="bd-cat-card pd-debt-table">
        <DataTable<DebtHistoryEntryDto>
          rowKey="id"
          loading={query.isLoading}
          columns={buildColumns()}
          dataSource={rows}
          locale={{ emptyText: t("Patient:Debt:Empty") }}
          pagination={pagination.buildConfig(total, showTotal)}
        />
      </div>
    </section>
  );
}
