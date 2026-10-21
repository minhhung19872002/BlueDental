import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { CreatePaymentDialog } from "@/features/patient-management/components/patient-detail/CreatePaymentDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { usePatientAdvises } from "../api/consultingQueries";
import { usePatientAccount, useTreatingPlans, type TreatmentPlanSlipDto } from "../api/treatmentPlanApi";
import { DeletePlanDialog } from "./plan/DeletePlanDialog";
import { PlanColumnConfigPopover } from "./plan/PlanColumnConfigPopover";
import { PrintMedicalRecordDialog } from "./plan/PrintMedicalRecordDialog";
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
 * opens is an existing one except the service list. New services go onto a
 * slip from its detail page ("Thêm dịch vụ phát sinh"), not from here; the
 * "Số phiếu điều trị" button (the old + merged with the code) only opens that
 * page — "Chi tiết phiếu" left this tab with it (owner, 2026-10-15). It lists
 * the slips whose Bác sĩ tiếp nhận the user may see by the Sơ đồ tổ chức — a
 * dentist their own, a head their whole subtree, an admin every slip — plus
 * any slip with a line assigned inside that scope (Bác sĩ điều trị or tư vấn).
 * Such a slip carries `seenThroughLines`: its figures are those lines' alone,
 * the other lines' money is masked, and it offers no invoice or delete (BA
 * bug 40). The summary cards and "Xem tất cả dịch vụ" follow that list.
 */
export function TreatmentPlanPanel({ patientId, patient }: Props) {
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  // There is no treatmentPlan subject: slips hang off the consulting leaves.
  const ability = useAbility("treatmentConsultation");
  // Hóa đơn opens "Tạo phiếu thanh toán" on the slip (owner 2026-10-12) — payment.create.
  const paymentAbility = useAbility("payment");
  // "Xoá phiếu điều trị" has a leaf of its own, apart from the consulting delete.
  const canDeletePlan = ability.can("deletePlan");
  const pagination = useTablePagination(20);
  const [columns, setColumns] = useState(defaultPlanColumns);
  const [serviceList, setServiceList] = useState<ServiceListTarget | null>(null);
  const [payPlan, setPayPlan] = useState<TreatmentPlanSlipDto | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<TreatmentPlanSlipDto | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const plansQuery = useTreatingPlans(patientId, branchId);
  // Dư nợ for the payment dialog; the server keeps it behind payment.read.
  const account = usePatientAccount(patientId, branchId, payPlan !== null && paymentAbility.canRead);
  const advises = usePatientAdvises({ patientId, clinicBranchId: branchId, maxResultCount: 200 });

  // The server's order: newest first, and a team head's own slips ahead of
  // their team's (owner 2026-10-15).
  const plans = useMemo(() => plansQuery.data?.items ?? [], [plansQuery.data]);
  // The cards keep reading newest slip first, whoever's slips lead the table.
  const summary = useMemo(
    () => summariseServices([...plans].sort((a, b) => b.creationTime.localeCompare(a.creationTime))),
    [plans],
  );
  const diagnosisByAdviseId = useMemo(
    () =>
      new Map(
        (advises.data?.items ?? []).map((advise) => [advise.id, advise.diagnosisName ?? ""]),
      ),
    [advises.data],
  );

  const rowActions = useMemo<PlanRowActions>(
    () => ({
      onViewServices: (plan) => setServiceList({ kind: "plan", plan }),
      // The reference's print dialog is about the patient, not the slip: it
      // reads the record files and the patient, and nothing off the row.
      onPrintRecord: () => setPrintOpen(true),
      onReceipt: paymentAbility.canCreate ? setPayPlan : undefined,
      onOpenPlan: (plan) => navigate(planDetailPath(patientId, plan.id, branchId)),
      onDelete: canDeletePlan ? setDeletingPlan : undefined,
    }),
    [navigate, patientId, branchId, paymentAbility.canCreate, canDeletePlan],
  );

  const serviceRows =
    serviceList?.kind === "plan" ? flattenServices([serviceList.plan]) : flattenServices(plans);
  const serviceTitle =
    serviceList?.kind === "plan"
      ? t("Treatment:Service:ListTitle", serviceList.plan.code)
      : t("Treatment:Service:ServiceList");
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
      <PlanToolbar onViewAll={() => setServiceList({ kind: "all" })} />
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
      {printOpen && (
        <PrintMedicalRecordDialog patient={patient} onClose={() => setPrintOpen(false)} />
      )}
      <CreatePaymentDialog
        open={payPlan !== null}
        patientId={patientId}
        branchId={branchId}
        plan={payPlan}
        focusServiceId={null}
        heldForPatient={account.data?.heldForPatient ?? 0}
        onClose={() => setPayPlan(null)}
        onSaved={() => setPayPlan(null)}
      />
      <DeletePlanDialog plan={deletingPlan} onClose={() => setDeletingPlan(null)} />
    </div>
  );
}
