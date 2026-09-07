import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { TreatmentStageDialog } from "@/features/patient-management/components/patient-detail/TreatmentStageDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { usePatientAdvises } from "../api/consultingQueries";
import { useTreatmentPlans, type TreatmentPlanSlipDto } from "../api/treatmentPlanApi";
import { InvoiceModal } from "./InvoiceModal";
import { CreatePlanDialog } from "./plan/CreatePlanDialog";
import { PlanColumnConfigPopover } from "./plan/PlanColumnConfigPopover";
import { PlanServiceListModal } from "./plan/PlanServiceListModal";
import { PlanSummaryCards } from "./plan/PlanSummaryCards";
import { PlanTable } from "./plan/PlanTable";
import { PlanToolbar } from "./plan/PlanToolbar";
import type { PlanRowActions } from "./plan/planColumns";
import {
  defaultPlanColumns,
  flattenServices,
  planDetailPath,
  summariseServices,
} from "./plan/planTypes";
import "./plan/treatment-plan.css";

interface Props {
  patientId: string;
  patient: PatientDto;
}

/** Which service list the modal shows: one slip, or every slip. */
type ServiceListTarget = { kind: "plan"; plan: TreatmentPlanSlipDto } | { kind: "all" };

/**
 * Tab "Kế hoạch điều trị": toolbar, the two summary cards and one row per slip.
 * Laid out from staging (reference-private/treatment-plan-tab); every dialog it
 * opens is an existing one except the create form and the service list.
 */
export function TreatmentPlanPanel({ patientId, patient }: Props) {
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const pagination = useTablePagination(20);
  const [columns, setColumns] = useState(defaultPlanColumns);
  const [createOpen, setCreateOpen] = useState(false);
  const [serviceList, setServiceList] = useState<ServiceListTarget | null>(null);
  const [stagePlan, setStagePlan] = useState<TreatmentPlanSlipDto | null>(null);
  const [invoicePlan, setInvoicePlan] = useState<TreatmentPlanSlipDto | null>(null);

  const plansQuery = useTreatmentPlans(patientId, branchId);
  const advises = usePatientAdvises({ patientId, clinicBranchId: branchId, maxResultCount: 200 });

  const plans = useMemo(
    () =>
      [...(plansQuery.data?.items ?? [])].sort((a, b) =>
        b.creationTime.localeCompare(a.creationTime),
      ),
    [plansQuery.data],
  );
  const summary = useMemo(() => summariseServices(plans), [plans]);
  const diagnosisByAdviseId = useMemo(
    () =>
      new Map(
        (advises.data?.items ?? []).map((advise) => [advise.id, advise.diagnosisName ?? ""]),
      ),
    [advises.data],
  );

  const rowActions = useMemo<PlanRowActions>(
    () => ({
      onAddStage: setStagePlan,
      onViewServices: (plan) => setServiceList({ kind: "plan", plan }),
      onReceipt: setInvoicePlan,
      onOpenPlan: (plan) => navigate(planDetailPath(patientId, plan.id, branchId)),
    }),
    [navigate, patientId, branchId],
  );

  const serviceRows =
    serviceList?.kind === "plan" ? flattenServices([serviceList.plan]) : flattenServices(plans);
  const serviceTitle =
    serviceList?.kind === "plan"
      ? t("Danh sách dịch vụ - {0}", serviceList.plan.code)
      : t("Danh sách dịch vụ");

  if (plansQuery.isLoading) {
    return (
      <div className="tp-root">
        <Spin />
      </div>
    );
  }

  return (
    <div className="tp-root">
      <PlanToolbar
        onCreate={() => setCreateOpen(true)}
        onViewAll={() => setServiceList({ kind: "all" })}
      />
      <PlanSummaryCards
        active={summary.active}
        recent={summary.recent}
        onOpen={(row) => navigate(planDetailPath(patientId, row.plan.id, branchId))}
      />

      <div className="tp-table-block">
        <PlanColumnConfigPopover value={columns} onChange={setColumns} />
        <PlanTable plans={plans} settings={columns} pagination={pagination} actions={rowActions} />
      </div>

      <CreatePlanDialog
        open={createOpen}
        patientId={patientId}
        branchId={branchId}
        onClose={() => setCreateOpen(false)}
      />
      <PlanServiceListModal
        open={serviceList !== null}
        title={serviceTitle}
        rows={serviceRows}
        diagnosisByAdviseId={diagnosisByAdviseId}
        onClose={() => setServiceList(null)}
      />
      <TreatmentStageDialog
        open={stagePlan !== null}
        patientId={patientId}
        patientCode={patient.patientCode}
        patientName={patient.fullName}
        branchId={branchId}
        plan={stagePlan}
        focusServiceId={null}
        onClose={() => setStagePlan(null)}
        onOpenPlan={() => setStagePlan(null)}
      />
      {invoicePlan && (
        <InvoiceModal open patient={patient} plan={invoicePlan} onClose={() => setInvoicePlan(null)} />
      )}
    </div>
  );
}
