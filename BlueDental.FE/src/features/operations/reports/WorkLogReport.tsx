import { useMemo, useState } from "react";
import { Input, Select } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { useWorkLog, type WorkLogAction, type WorkLogRow } from "../api/operationReportApi";
import { formatMoney } from "./formatMoney";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { StaffFilter } from "./StaffFilter";
import { WorkLogTable } from "./WorkLogTable";
import { workLogTotal, workLogVariantOf } from "./workLogVariants";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { usePeriodRange } from "./usePeriodRange";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

/** The reference's own list, in its own order. */
export const ACTION_LABELS: Record<WorkLogAction, string> = {
  1: "Chẩn đoán",
  2: "Tư vấn",
  3: "Điều trị",
  4: "Công đoạn",
  5: "Tái khám",
  6: "Thanh toán",
  7: "Hoàn tiền",
  8: "Hủy dịch vụ",
  9: "Chuyển đổi dịch vụ",
  10: "Lịch hẹn",
  11: "Tiếp nhận",
};

const ACTION_ORDER: WorkLogAction[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

interface Props {
  /** Which division's Báo cáo this is — they differ, see workLogVariants. */
  division: string;
}

/**
 * Báo cáo — one block per patient-visit, and inside it one group per action.
 *
 * The table is the same on every division that has this tab; the filters above
 * it and where the figure sits are not, so both come from the division's own
 * variant rather than being drawn the same everywhere.
 */
export function WorkLogReport({ division }: Props) {
  const variant = workLogVariantOf(division);

  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [staffId, setStaffId] = useState<string | undefined>();
  const [actions, setActions] = useState<WorkLogAction[]>(ACTION_ORDER);

  const debounced = useDebounce(keyword, 300);

  const query = useWorkLog(
    {
      periodCode: range.periodCode,
      anchorIso: range.anchorIso,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
      filter: debounced.trim() || undefined,
    },
    { Actions: actions, StaffId: staffId },
  );

  const rows = useMemo<WorkLogRow[]>(() => query.data?.items ?? [], [query.data]);
  const shows = (filter: (typeof variant.filters)[number]) => variant.filters.includes(filter);

  const card = (
    <div className={cn("bd-ops-stat", "bd-ops-stat--single")}>
      <span className="bd-ops-stat-icon bd-ops-stat-icon--green">
        <CheckCircleOutlined />
      </span>
      <span className="bd-ops-stat-body">
        <span className="bd-ops-stat-value bd-ops-stat-value--green">
          {formatMoney(query.data?.plannedSales ?? 0)}
        </span>
        <span className="bd-ops-stat-label">{t("Doanh số chốt kế hoạch")}</span>
      </span>
    </div>
  );

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} />
      </div>

      <div
        className={cn(
          "bd-ops-report-head",
          // With no filters the figure stands alone on the left.
          variant.card === "left" && "bd-ops-report-head--start",
        )}
      >
        {variant.filters.length > 0 ? (
          <div className="bd-ops-report-filters">
            {shows("staff") ? (
              <StaffFilter
                label={t("Người tạo")}
                value={staffId}
                onChange={(value) => {
                  setStaffId(value);
                  pagination.resetToFirstPage();
                }}
              />
            ) : null}

            {shows("actions") ? (
              <Select<WorkLogAction[]>
                className="bd-ops-filter bd-ops-filter--wide"
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                placeholder={t("Hành động")}
                aria-label={t("Hành động")}
                value={actions}
                onChange={(value) => {
                  setActions(value);
                  pagination.resetToFirstPage();
                }}
                options={ACTION_ORDER.map((key) => ({ value: key, label: t(ACTION_LABELS[key]) }))}
              />
            ) : null}

            {shows("patient") ? (
              <Input
                className="bd-ops-search"
                placeholder={t("Tìm kiếm khách hàng")}
                aria-label={t("Tìm kiếm khách hàng")}
                value={keyword}
                allowClear
                onChange={(event) => {
                  setKeyword(event.target.value);
                  pagination.resetToFirstPage();
                }}
              />
            ) : null}
          </div>
        ) : null}

        {card}
      </div>

      <WorkLogTable
        rows={rows}
        loading={query.isFetching}
        totalCount={query.data?.totalCount ?? 0}
        pagination={pagination}
        showTotal={workLogTotal(variant)}
      />
    </div>
  );
}
