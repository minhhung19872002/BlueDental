import { useMemo, useState } from "react";
import type { TableColumnsType } from "antd";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { RecordCard } from "@/components/RecordCard";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatTeeth } from "../../api/consultingApi";
import { usePatientAdvises } from "../../api/consultingQueries";
import {
  PAYMENT_KIND,
  PAYMENT_METHOD,
  usePatientPayments,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import { moneyText } from "../plan/planTypes";
import { ServiceDetailDialog } from "./ServiceDetailDialog";
import { dash, planDetailRows, type PlanDetailRow } from "./planDetailTypes";

const NARROW_SCREEN = "(max-width: 640px)";
const PAGE_CAP = 200;

interface DebtRow extends PlanDetailRow {
  /** What the held balance covered on this line. */
  debt: number;
}

interface Props {
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  branchId: string;
}

function buildColumns(onView: (row: DebtRow) => void): TableColumnsType<DebtRow> {
  return [
    { key: "service", title: t("Dịch vụ"), width: 230, render: (_, r) => r.service.serviceName ?? r.service.code },
    { key: "diagnosis", title: t("Chẩn đoán"), width: 160, render: (_, r) => dash(r.advise?.diagnosisName) },
    { key: "dentist", title: t("Bác sĩ điều trị"), width: 160, render: (_, r) => dash(r.plan.dentistName) },
    { key: "teeth", title: t("Răng"), width: 110, render: (_, r) => formatTeeth(r.service.teeth) },
    { key: "quantity", title: t("Số lượng"), width: 90, align: "center", render: (_, r) => r.service.quantity },
    { key: "debt", title: t("Dư nợ"), width: 130, align: "right", render: (_, r) => moneyText(r.debt) },
    { key: "total", title: t("Tổng tiền"), width: 140, align: "right", render: (_, r) => moneyText(r.service.effectiveAmount) },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 70,
      align: "center",
      fixed: "right",
      render: (_, r) => (
        <button type="button" className="tp-eye" aria-label={t("Xem chi tiết")} onClick={() => onView(r)}>
          <Eye size={16} aria-hidden="true" />
        </button>
      ),
    },
  ];
}

/**
 * Tab "Dư nợ": the lines of this slip that were settled out of the balance the
 * clinic holds for the patient (receipts paid by "Dư nợ"), and how much each took.
 */
export function PlanDebtTab({ patient, plan, branchId }: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);
  const pagination = useTablePagination(20);
  const advises = usePatientAdvises({ patientId: patient.id, clinicBranchId: branchId, maxResultCount: 200 });
  const query = usePatientPayments({
    patientId: patient.id,
    clinicBranchId: branchId,
    treatmentPlanId: plan.id,
    kind: PAYMENT_KIND.Payment,
    maxResultCount: PAGE_CAP,
  });
  const [viewing, setViewing] = useState<PlanDetailRow | null>(null);

  const rows = useMemo<DebtRow[]>(() => {
    const debtByService = new Map<string, number>();
    for (const payment of query.data?.items ?? []) {
      if (payment.method !== PAYMENT_METHOD.OutstandingDebt) continue;
      for (const line of payment.lines) {
        debtByService.set(line.treatmentServiceId, (debtByService.get(line.treatmentServiceId) ?? 0) + line.amount);
      }
    }
    return planDetailRows(plan, advises.data?.items ?? [])
      .filter((row) => debtByService.has(row.service.id))
      .map((row) => ({ ...row, debt: debtByService.get(row.service.id) ?? 0 }));
  }, [plan, advises.data, query.data]);

  const pageRows = rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const showTotal = countedTotal(t("dịch vụ"));
  const columns = useMemo(() => buildColumns(setViewing), []);

  return (
    <div className="pdt-pane">
      {narrow ? (
        <div className="tp-card-list pdt-card-list">
          {rows.length === 0 && <p className="bd-rc-empty">{t("Không có dữ liệu")}</p>}
          <div className="bd-rc-list">
            {pageRows.map((row) => (
              <RecordCard
                key={row.service.id}
                title={t("{0} #{1}", t("Dịch vụ"), row.index)}
                extra={
                  <button type="button" className="bd-rc-action" aria-label={t("Xem chi tiết")} onClick={() => setViewing(row)}>
                    <Eye size={16} aria-hidden="true" />
                  </button>
                }
                rows={[
                  { key: "service", label: t("Dịch vụ"), value: row.service.serviceName ?? row.service.code },
                  { key: "debt", label: t("Dư nợ"), value: <strong>{moneyText(row.debt)}</strong> },
                  { key: "total", label: t("Tổng tiền"), value: moneyText(row.service.effectiveAmount) },
                ]}
                moreRows={[
                  { key: "diagnosis", label: t("Chẩn đoán"), value: dash(row.advise?.diagnosisName) },
                  { key: "dentist", label: t("Bác sĩ điều trị"), value: dash(row.plan.dentistName) },
                  { key: "teeth", label: t("Răng"), value: formatTeeth(row.service.teeth) },
                  { key: "quantity", label: t("Số lượng"), value: row.service.quantity },
                ]}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bd-cat-card tp-table pdt-table">
          <DataTable<DebtRow>
            rowKey={(row) => row.service.id}
            loading={query.isLoading}
            columns={columns}
            dataSource={pageRows}
            pagination={pagination.buildConfig(rows.length, showTotal)}
            locale={{ emptyText: t("Không có dữ liệu") }}
          />
        </div>
      )}
      <ServiceDetailDialog row={viewing} patient={patient} onClose={() => setViewing(null)} />
    </div>
  );
}
