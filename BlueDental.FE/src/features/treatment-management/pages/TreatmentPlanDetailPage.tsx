import { Spin } from "antd";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { usePatientDto } from "@/features/patient-management/api/patientQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { usePlanSlip } from "../api/treatmentPlanApi";
import { PlanDebtTab } from "../components/plan-detail/PlanDebtTab";
import { PlanDetailHead } from "../components/plan-detail/PlanDetailHead";
import { PlanDetailHeader } from "../components/plan-detail/PlanDetailHeader";
import { PlanPaymentsTab } from "../components/plan-detail/PlanPaymentsTab";
import { PlanRefundsTab } from "../components/plan-detail/PlanRefundsTab";
import { PlanServicesTab } from "../components/plan-detail/PlanServicesTab";
import { PLAN_TAB, isPlanTab, type PlanTabKey } from "../components/plan-detail/planDetailTypes";
import "../components/plan/treatment-plan.css";
import "../components/plan-detail/plan-detail.css";

const TAB_PARAM = "planTab";

/**
 * /patient/:id/treatment-plan/:planId — "Chi tiết kế hoạch điều trị".
 *
 * The reference keeps the open tab in `?planTab=` (detail, payment-v2,
 * refund, debt) and the branch in `?branchId=`; both survive a reload here.
 * Tabs, toolbar and table sit together in one white card under the breadcrumb.
 */
export function TreatmentPlanDetailPage() {
  const { id = "", planId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const patient = usePatientDto(id);
  const plan = usePlanSlip(planId);

  const rawTab = searchParams.get(TAB_PARAM);
  const tab: PlanTabKey = isPlanTab(rawTab) ? rawTab : PLAN_TAB.detail;

  const handleTabChange = (next: PlanTabKey) => {
    const params = new URLSearchParams(searchParams);
    params.set(TAB_PARAM, next);
    setSearchParams(params, { replace: true });
  };

  if (patient.isLoading || plan.isLoading) {
    return (
      <div className="page-container pdt-page pdt-page--center">
        <Spin size="large" />
      </div>
    );
  }
  if (!patient.data || !plan.data || plan.data.patientId !== patient.data.id) {
    return (
      <div className="page-container pdt-page">
        <EmptyState
          title={t("Không tìm thấy kế hoạch điều trị")}
          actionLabel={t("Quay lại hồ sơ")}
          onAction={() => navigate(`/patient/${id}?tab=treatment-plan&branchId=${encodeURIComponent(branchId)}`)}
        />
      </div>
    );
  }

  const tabProps = { patient: patient.data, plan: plan.data, branchId };

  return (
    <div className="page-container pdt-page">
      <PlanDetailHeader patient={patient.data} plan={plan.data} branchId={branchId} />
      <section className="pdt-body">
        <PlanDetailHead tab={tab} payment={plan.data.payment} onTabChange={handleTabChange} />
        {tab === PLAN_TAB.detail && <PlanServicesTab {...tabProps} />}
        {tab === PLAN_TAB.payment && <PlanPaymentsTab {...tabProps} />}
        {tab === PLAN_TAB.refund && <PlanRefundsTab {...tabProps} />}
        {tab === PLAN_TAB.debt && <PlanDebtTab {...tabProps} />}
      </section>
    </div>
  );
}
