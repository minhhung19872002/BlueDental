import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import {
  OPERATIONS_DEPARTMENT,
  type OperationsDepartment,
  type OperationsTaskStatsDto,
} from "../api/operationsApi";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

/** The divisions the design puts a card each on, with its accent. */
const DIVISIONS: { department: OperationsDepartment; labelKey: string; color: string }[] = [
  { department: OPERATIONS_DEPARTMENT.Assistant, labelKey: "Operations:AssistantBlock", color: brand.blue },
  { department: OPERATIONS_DEPARTMENT.Reception, labelKey: "Operations:ReceptionBlock", color: brand.goldDeep },
  { department: OPERATIONS_DEPARTMENT.Cskh, labelKey: "Operations:CSKHBlock", color: brand.green },
  { department: OPERATIONS_DEPARTMENT.Marketing, labelKey: "Operations:MarketingBlock", color: brand.purple },
  { department: OPERATIONS_DEPARTMENT.Security, labelKey: "Operations:SecurityBlock", color: brand.teal },
  { department: OPERATIONS_DEPARTMENT.Treatment, labelKey: "Operations:TreatmentBlock", color: brand.pink },
  { department: OPERATIONS_DEPARTMENT.Finance, labelKey: "Operations:FinanceBlock", color: brand.red },
];

/**
 * One card per division: how many of its tasks are finished, as a share of the
 * division's total. Each card is its own small stats read, so a division with
 * no tasks simply shows zero rather than blocking the others.
 */
export function DivisionStatsGrid() {
  const clinicBranchId = useCurrentBranchId();

  const results = useQueries({
    queries: DIVISIONS.map((division) => {
      const params = { clinicBranchId, department: division.department };
      return {
        queryKey: ["operations", "task-stats", params] as const,
        queryFn: async () => {
          const res = await api.get<OperationsTaskStatsDto>(
            "/v1/app/operations-tasks/stats",
            { params },
          );
          return res.data;
        },
        staleTime: 60_000,
      };
    }),
  });

  return (
    <div className="ops-grid">
      {DIVISIONS.map((division, i) => {
        const stats = results[i].data;
        const total = stats?.total ?? 0;
        const done = stats?.done ?? 0;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);
        return (
          <div key={division.department} className="page-card ops-card">
            <div className="ops-card-head">
              <span className="ops-dot" style={{ background: division.color }} />
              <span className="ops-name">{t(division.labelKey)}</span>
            </div>
            <div className="ops-metric-label">{t("Operations:CompletedTasks")}</div>
            <div className="ops-metric-value" style={{ color: division.color }}>
              {done}/{total}
            </div>
            <div className="ops-bar">
              <span
                className="ops-bar-fill"
                style={{ width: `${percent}%`, background: division.color }}
              />
            </div>
            <div className="ops-caption">
              {t("Operations:OverdueInProgress", stats?.overdue ?? 0, stats?.inProgress ?? 0)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
