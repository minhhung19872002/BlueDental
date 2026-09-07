import { Pagination } from "antd";
import { ClipboardList, Eye, Plus, Receipt } from "lucide-react";
import { RecordCard } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { planCardRows } from "./planCardRows";
import type { PlanRowActions } from "./planColumns";
import type { PlanColumnSetting } from "./planTypes";

interface Props {
  plans: TreatmentPlanSlipDto[];
  total: number;
  settings: PlanColumnSetting[];
  pagination: TablePagination;
  actions: PlanRowActions;
}

interface ActionsProps {
  plan: TreatmentPlanSlipDto;
  actions: PlanRowActions;
}

/** The two fixed table edges folded onto the card head: + stage, eye, print, receipt. */
function PlanCardActions({ plan, actions }: ActionsProps) {
  return (
    <>
      <button
        type="button"
        className="bd-rc-action"
        aria-label={t("Thêm công đoạn {0}", plan.code)}
        onClick={() => actions.onAddStage(plan)}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="bd-rc-action"
        aria-label={t("Danh sách dịch vụ - {0}", plan.code)}
        onClick={() => actions.onViewServices(plan)}
      >
        <Eye size={16} aria-hidden="true" />
      </button>
      {/* "In bệnh án" is kept as a control only; its action is a later round. */}
      <button type="button" className="bd-rc-action" aria-label={t("In bệnh án")}>
        <ClipboardList size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="bd-rc-action"
        aria-label={t("Phiếu thu {0}", plan.code)}
        onClick={() => actions.onReceipt(plan)}
      >
        <Receipt size={16} aria-hidden="true" />
      </button>
    </>
  );
}

/**
 * The plan table at ≤640px: one card per slip, its code and the row actions
 * on the head, the visible columns as label/value rows. Same pager as the
 * table so page and size survive the layout switch.
 */
export function PlanCardList({ plans, total, settings, pagination, actions }: Props) {
  return (
    <div className="tp-card-list">
      {plans.length === 0 && <p className="bd-rc-empty">{t("Chưa có kế hoạch điều trị")}</p>}
      <div className="bd-rc-list">
        {plans.map((plan) => {
          const { rows, moreRows } = planCardRows(plan, settings);
          return (
            <RecordCard
              key={plan.id}
              title={
                <button type="button" className="tp-code" onClick={() => actions.onOpenPlan(plan)}>
                  {plan.code}
                </button>
              }
              extra={<PlanCardActions plan={plan} actions={actions} />}
              rows={rows}
              moreRows={moreRows}
            />
          );
        })}
      </div>
      {total > 0 && (
        <Pagination className="tp-card-pager" {...pagination.buildConfig(total)} />
      )}
    </div>
  );
}
