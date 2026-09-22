import type { TableColumnsType } from "antd";
import { ClipboardList, Eye, Plus, Receipt } from "lucide-react";
import { t } from "@/lib/i18n";
import { ActionTooltip } from "./ActionTooltip";
import { formatDate } from "@/utils/format";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import {
  PLAN_COLUMN_LABELS,
  moneyText,
  planPill,
  planMoney,
  type PlanColumnKey,
  type PlanColumnSetting,
  type PlanMoney,
} from "./planTypes";

export interface PlanRowActions {
  onAddStage: (plan: TreatmentPlanSlipDto) => void;
  onViewServices: (plan: TreatmentPlanSlipDto) => void;
  onPrintRecord: (plan: TreatmentPlanSlipDto) => void;
  onReceipt: (plan: TreatmentPlanSlipDto) => void;
  /** The code link — the slip's own screen. */
  onOpenPlan: (plan: TreatmentPlanSlipDto) => void;
}

type Column = TableColumnsType<TreatmentPlanSlipDto>[number];

function money(field: keyof PlanMoney, width: number, modifier?: string): Column {
  const key = field satisfies PlanColumnKey;
  return {
    key,
    title: t(PLAN_COLUMN_LABELS[key]),
    width,
    align: "right",
    render: (_, plan) => (
      <span className={["tp-cell-money", modifier].filter(Boolean).join(" ")}>
        {moneyText(planMoney(plan)[field])}
      </span>
    ),
  };
}

function statusPill(plan: TreatmentPlanSlipDto) {
  const pill = planPill(plan);
  return (
    <span className={["tp-pill", pill.modifier].filter(Boolean).join(" ")}>{t(pill.label)}</span>
  );
}

/** The twelve configurable columns, by key; widths measured on the reference. */
function configurableColumns(actions: PlanRowActions): Record<PlanColumnKey, Column> {
  return {
    code: {
      key: "code",
      title: t(PLAN_COLUMN_LABELS.code),
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
      render: (_, plan) => (
        <ActionTooltip title={t("Danh sách dịch vụ")}>
          <button
            type="button"
            className="tp-eye"
            aria-label={t("Danh sách dịch vụ - {0}", plan.code)}
            onClick={() => actions.onViewServices(plan)}
          >
            <Eye size={18} aria-hidden="true" />
          </button>
        </ActionTooltip>
      ),
    },
    dentist: {
      key: "dentist",
      title: t(PLAN_COLUMN_LABELS.dentist),
      width: 150,
      render: (_, plan) => <span className="tp-cell-small">{plan.dentistName}</span>,
    },
    status: {
      key: "status",
      title: t(PLAN_COLUMN_LABELS.status),
      width: 160,
      render: (_, plan) => statusPill(plan),
    },
    createdAt: {
      key: "createdAt",
      title: t(PLAN_COLUMN_LABELS.createdAt),
      width: 120,
      render: (_, plan) => (
        <span className="tp-cell-small tp-cell-small--muted">{formatDate(plan.creationTime)}</span>
      ),
    },
    total: money("total", 130),
    discount: money("discount", 110, "tp-cell-money--discount"),
    amount: money("amount", 130),
    paid: money("paid", 130, "tp-cell-money--paid"),
    refund: money("refund", 130),
    remaining: money("remaining", 130, "tp-cell-money--due"),
    receivable: money("receivable", 130, "tp-cell-money--receivable"),
  };
}

/** Fixed edges plus the visible configurable columns in the saved order. */
export function buildPlanColumns(
  settings: PlanColumnSetting[],
  actions: PlanRowActions,
): TableColumnsType<TreatmentPlanSlipDto> {
  const byKey = configurableColumns(actions);
  return [
    {
      key: "addStage",
      title: t("Thêm công đoạn"),
      width: 140,
      align: "center",
      render: (_, plan) => (
        <button
          type="button"
          className="tp-add-stage"
          aria-label={t("Thêm công đoạn {0}", plan.code)}
          onClick={() => actions.onAddStage(plan)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      ),
    },
    ...settings.filter((item) => item.visible).map((item) => byKey[item.key]),
    {
      key: "actions",
      title: t("Thao tác"),
      width: 100,
      align: "center",
      fixed: "right",
      render: (_, plan) => (
        <span className="tp-actions">
          <ActionTooltip title={t("In bệnh án")}>
            <button
              type="button"
              className="tp-action"
              aria-label={t("In bệnh án {0}", plan.code)}
              onClick={() => actions.onPrintRecord(plan)}
            >
              <ClipboardList size={16} aria-hidden="true" />
            </button>
          </ActionTooltip>
          <ActionTooltip title={t("Hóa đơn")}>
            <button
              type="button"
              className="tp-action"
              aria-label={t("Phiếu thu {0}", plan.code)}
              onClick={() => actions.onReceipt(plan)}
            >
              <Receipt size={16} aria-hidden="true" />
            </button>
          </ActionTooltip>
        </span>
      ),
    },
  ];
}
