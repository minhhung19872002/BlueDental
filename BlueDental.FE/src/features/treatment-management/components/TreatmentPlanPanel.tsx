import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { TreatmentStageDialog } from "@/features/patient-management/components/patient-detail/TreatmentStageDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { usePatientAdvises } from "../api/consultingQueries";
import { useTreatmentPlans, type TreatmentPlanSlipDto } from "../api/treatmentPlanApi";
import { InvoiceModal } from "./InvoiceModal";
import { CreatePlanDialog } from "./plan/CreatePlanDialog";
import { PlanColumnConfigPopover } from "./plan/PlanColumnConfigPopover";
import { PrintMedicalRecordDialog } from "./plan/PrintMedicalRecordDialog";
import { PlanServiceListModal } from "./plan/PlanServiceListModal";
import { PlanSummaryCards } from "./plan/PlanSummaryCards";
import { PlanTable } from "./plan/PlanTable";
import { PlanToolbar } from "./plan/PlanToolbar";
import type { PlanRowActions } from "./plan/planColumns";
import { PLAN_TAB } from "./plan-detail/planDetailTypes";
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
  // The slip is opened through the consulting line, so the server gates it on
  // treatmentConsultation.create — there is no treatmentPlan subject.
  const ability = useAbility("treatmentConsultation");
  const pagination = useTablePagination(20);
  const [columns, setColumns] = useState(defaultPlanColumns);
  const [createOpen, setCreateOpen] = useState(false);
  const [serviceList, setServiceList] = useState<ServiceListTarget | null>(null);
  const [stagePlan, setStagePlan] = useState<TreatmentPlanSlipDto | null>(null);
  const [invoicePlan, setInvoicePlan] = useState<TreatmentPlanSlipDto | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

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
      // The reference's print dialog is about the patient, not the slip: it
      // reads the record files and the patient, and nothing off the row.
      onPrintRecord: () => setPrintOpen(true),
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
  // One slip's list prints the DT code in front of each service, and the code
  // opens that slip; the list of every slip leaves it off (measured 2026-09-21).
  const showServiceCode = serviceList?.kind === "plan";

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
        onCreate={ability.canCreate ? () => setCreateOpen(true) : undefined}
        onViewAll={() => setServiceList({ kind: "all" })}
      />
      <PlanSummaryCards
        active={summary.active}
        activeCount={summary.activeCount}
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
        showCode={showServiceCode}
        diagnosisByAdviseId={diagnosisByAdviseId}
        onClose={() => setServiceList(null)}
        onOpenPlan={(planId) => {
          setServiceList(null);
          navigate(planDetailPath(patientId, planId, branchId));
        }}
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
        onOpenPlan={() => {
          // Same jump as from the Hồ sơ tab: the slip's own Chi tiết screen.
          const target = stagePlan;
          setStagePlan(null);
          if (target) {
            navigate(planDetailPath(patientId, target.id, branchId, PLAN_TAB.detail));
          }
        }}
      />
      {printOpen && (
        <PrintMedicalRecordDialog patient={patient} onClose={() => setPrintOpen(false)} />
      )}
      {invoicePlan && (
        <InvoiceModal open patient={patient} plan={invoicePlan} onClose={() => setInvoicePlan(null)} />
      )}
    </div>
  );
}
