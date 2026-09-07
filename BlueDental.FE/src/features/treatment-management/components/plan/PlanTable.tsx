import { useMemo } from "react";
import { DataTable } from "@/components/DataTable";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { PlanCardList } from "./PlanCardList";
import { buildPlanColumns, type PlanRowActions } from "./planColumns";
import type { PlanColumnSetting } from "./planTypes";

interface Props {
  plans: TreatmentPlanSlipDto[];
  settings: PlanColumnSetting[];
  pagination: TablePagination;
  actions: PlanRowActions;
}

/** Phones get the cards from "Thêm đơn thuốc" instead of a sideways-scrolling table. */
const NARROW_SCREEN = "(max-width: 640px)";

/**
 * The slip list: a table on desktop, one card per slip at 640px and below.
 * Both read the same "Cột hiển thị" settings and share one pager.
 */
export function PlanTable({ plans, settings, pagination, actions }: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);
  const columns = useMemo(() => buildPlanColumns(settings, actions), [settings, actions]);
  const pageRows = plans.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);

  if (narrow) {
    return (
      <PlanCardList
        plans={pageRows}
        total={plans.length}
        settings={settings}
        pagination={pagination}
        actions={actions}
      />
    );
  }

  return (
    <div className="bd-cat-card tp-table">
      <DataTable<TreatmentPlanSlipDto>
        rowKey="id"
        columns={columns}
        dataSource={pageRows}
        pagination={pagination.buildConfig(plans.length)}
        locale={{ emptyText: t("Chưa có kế hoạch điều trị") }}
      />
    </div>
  );
}
