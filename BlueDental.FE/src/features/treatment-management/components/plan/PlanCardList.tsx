import { Pagination } from "antd";
import { ClipboardList, Eye, Receipt, Trash2 } from "lucide-react";
import { RecordCard } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { ActionTooltip } from "@/components/ActionTooltip";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { PlanCodeLink } from "./PlanCodeLink";
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

/** The row actions folded onto the card head: eye, print, receipt, bin. */
function PlanCardActions({ plan, actions }: ActionsProps) {
  return (
    <>
      <ActionTooltip title={t("Treatment:Plan:ServiceList")}>
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Treatment:Plan:ServiceListFor", plan.code)}
          onClick={() => actions.onViewServices(plan)}
        >
          <Eye size={16} aria-hidden="true" />
        </button>
      </ActionTooltip>
      <ActionTooltip title={t("Treatment:Plan:PrintMedicalRecord")}>
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Treatment:Plan:PrintMedicalRecordFor", plan.code)}
          onClick={() => actions.onPrintRecord(plan)}
        >
          <ClipboardList size={16} aria-hidden="true" />
        </button>
      </ActionTooltip>
      {actions.onReceipt && (
        <ActionTooltip title={t("Treatment:Plan:Invoice")}>
          <button
            type="button"
            className="bd-rc-action"
            aria-label={t("Treatment:Plan:Receipt", plan.code)}
            onClick={() => actions.onReceipt?.(plan)}
          >
            <Receipt size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
      {actions.onDelete && (
        <ActionTooltip title={t("Treatment:Plan:Delete")}>
          <button
            type="button"
            className="bd-rc-action tp-card-delete"
            aria-label={t("Treatment:Plan:DeleteFor", plan.code)}
            onClick={() => actions.onDelete?.(plan)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
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
      {plans.length === 0 && <p className="bd-rc-empty">{t("Treatment:Plan:NoPlan")}</p>}
      <div className="bd-rc-list">
        {plans.map((plan) => {
          const { rows, moreRows } = planCardRows(plan, settings);
          return (
            <RecordCard
              key={plan.id}
              title={<PlanCodeLink plan={plan} onOpen={actions.onOpenPlan} />}
              extra={<PlanCardActions plan={plan} actions={actions} />}
              rows={rows}
              moreRows={moreRows}
            />
          );
        })}
      </div>
      {total > 0 && <Pagination className="tp-card-pager" {...pagination.buildConfig(total)} />}
    </div>
  );
}
