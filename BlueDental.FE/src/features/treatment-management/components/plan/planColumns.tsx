import type { TableColumnsType } from "antd";
import { ClipboardList, Eye, Plus, Receipt, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { ActionTooltip } from "@/components/ActionTooltip";
import { formatDate } from "@/utils/format";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import {
  planColumnLabels,
  moneyCellClass,
  moneyText,
  planPill,
  planMoney,
  type PlanColumnKey,
  type PlanColumnSetting,
  type PlanMoney,
} from "./planTypes";

export interface PlanRowActions {
  /** "Thêm công đoạn"; left out without treatmentStage.read — the column goes with it. */
  onAddStage?: (plan: TreatmentPlanSlipDto) => void;
  onViewServices: (plan: TreatmentPlanSlipDto) => void;
  onPrintRecord: (plan: TreatmentPlanSlipDto) => void;
  /** The invoice icon; left out when the user may not issue one (payment.finalize). */
  onReceipt?: (plan: TreatmentPlanSlipDto) => void;
  /** The code link — the slip's own screen. */
  onOpenPlan: (plan: TreatmentPlanSlipDto) => void;
  /** The red bin; left out without treatmentConsultation.deletePlan. */
  onDelete?: (plan: TreatmentPlanSlipDto) => void;
}

type Column = TableColumnsType<TreatmentPlanSlipDto>[number];

function money(field: keyof PlanMoney, width: number): Column {
  const key = field satisfies PlanColumnKey;
  const labels = planColumnLabels();
  return {
    key,
    title: labels[key],
    width,
    align: "right",
    render: (_, plan) => {
      const value = planMoney(plan)[field];
      return <span className={moneyCellClass(field, value)}>{moneyText(value)}</span>;
    },
  };
}

function statusPill(plan: TreatmentPlanSlipDto) {
  const pill = planPill(plan);
  return <span className={["tp-pill", pill.modifier].filter(Boolean).join(" ")}>{pill.label}</span>;
}

/** The twelve configurable columns, by key; widths measured on the reference. */
function configurableColumns(actions: PlanRowActions): Record<PlanColumnKey, Column> {
  const labels = planColumnLabels();
  return {
    code: {
      key: "code",
      title: labels.code,
      width: 110,
      render: (_, plan) => (
        <button type="button" className="tp-code" onClick={() => actions.onOpenPlan(plan)}>
          {plan.code}
        </button>
      ),
    },
    services: {
      key: "services",
      title: "",
      width: 48,
      align: "center",
      // Icon only: opt out of the 100px floor every other header carries.
      className: "bd-col-icon",
      render: (_, plan) => (
        <ActionTooltip title={t("Treatment:Plan:ServiceList")}>
          <button
            type="button"
            className="tp-eye"
            aria-label={t("Treatment:Plan:ServiceListFor", plan.code)}
            onClick={() => actions.onViewServices(plan)}
          >
            <Eye size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      ),
    },
    dentist: {
      key: "dentist",
      title: labels.dentist,
      width: 150,
      render: (_, plan) => <span className="tp-cell-small">{plan.dentistName}</span>,
    },
    status: {
      key: "status",
      title: labels.status,
      width: 160,
      render: (_, plan) => statusPill(plan),
    },
    createdAt: {
      key: "createdAt",
      title: labels.createdAt,
      width: 120,
      render: (_, plan) => (
        <span className="tp-cell-small tp-cell-small--muted">{formatDate(plan.creationTime)}</span>
      ),
    },
    total: money("total", 130),
    discount: money("discount", 110),
    amount: money("amount", 130),
    paid: money("paid", 130),
    refund: money("refund", 130),
    remaining: money("remaining", 130),
    receivable: money("receivable", 130),
  };
}

/** Fixed edges plus the visible configurable columns in the saved order. */
export function buildPlanColumns(
  settings: PlanColumnSetting[],
  actions: PlanRowActions,
): TableColumnsType<TreatmentPlanSlipDto> {
  const byKey = configurableColumns(actions);
  const { onAddStage } = actions;
  const addStage: TableColumnsType<TreatmentPlanSlipDto> = onAddStage
    ? [
        {
          key: "addStage",
          title: t("Treatment:Stage:AddStage"),
          width: 140,
          align: "center",
          render: (_, plan) => (
            <button
              type="button"
              className="tp-add-stage"
              aria-label={t("Treatment:Stage:AddStageFor", plan.code)}
              onClick={() => onAddStage(plan)}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          ),
        },
      ]
    : [];
  return [
    ...addStage,
    ...settings.filter((item) => item.visible).map((item) => byKey[item.key]),
    {
      key: "actions",
      title: t("Common:Actions"),
      // 32px per icon plus the 4px gaps and the cell's padding.
      width: actions.onDelete ? 136 : 100,
      align: "center",
      fixed: "right",
      render: (_, plan) => (
        <span className="tp-actions">
          <ActionTooltip title={t("Treatment:Plan:PrintMedicalRecord")}>
            <button
              type="button"
              className="tp-action"
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
                className="tp-action"
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
                className="tp-action tp-action--danger"
                aria-label={t("Treatment:Plan:DeleteFor", plan.code)}
                onClick={() => actions.onDelete?.(plan)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </ActionTooltip>
          )}
        </span>
      ),
    },
  ];
}
