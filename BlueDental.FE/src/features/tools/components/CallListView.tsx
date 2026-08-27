import { useMemo, useState } from "react";
import { Tag } from "antd";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { useCallLogs, type CallLogDto } from "../api/toolsApi";
import { callLogStatusTag, providerLabel } from "./callCatalog";
import { DataTable } from "@/components/DataTable";
import { PeriodBar } from "@/components/PeriodBar";
import { StaffFilter } from "@/components/StaffFilter";
import { useTablePagination } from "@/hooks/useTablePagination";
import { periodBounds, toIsoDate, usePeriodRange } from "@/hooks/usePeriodRange";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

/**
 * Danh Sách Cuộc Gọi — the PBX call history, read through the same
 * Ngày / Tuần / Tháng window and staff filter the reference gives it.
 */
export function CallListView() {
  const range = usePeriodRange("day");
  const [staffId, setStaffId] = useState<string | undefined>();
  const pagination = useTablePagination();

  // Walking to another window starts reading it from its first page.
  const windowKey = `${range.period}:${range.anchorIso}`;
  const [prevWindowKey, setPrevWindowKey] = useState(windowKey);
  if (windowKey !== prevWindowKey) {
    setPrevWindowKey(windowKey);
    pagination.resetToFirstPage();
  }

  const { start, end } = periodBounds(range.period, range.anchor);
  const { data, isFetching } = useCallLogs({
    fromDate: toIsoDate(start),
    // The server reads CalledAt < ToDate, so the window closes the day after.
    toDate: dayjs(end).add(1, "day").format("YYYY-MM-DD"),
    staffId,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const columns = useMemo<ColumnsType<CallLogDto>>(
    () => [
      {
        key: "staff",
        title: t("Nhân viên"),
        render: (_, log) => log.staffName ?? "—",
      },
      { key: "branch", title: t("Chi nhánh"), dataIndex: "branchName" },
      {
        key: "callCode",
        title: t("Mã cuộc gọi"),
        render: (_, log) => <span className="bd-cat-num">{log.callCode}</span>,
      },
      {
        key: "extensionCode",
        title: t("Mã mở rộng"),
        render: (_, log) => log.extensionCode ?? "—",
      },
      { key: "phoneNumber", title: t("Số điện thoại"), dataIndex: "phoneNumber", width: 140 },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 120,
        render: (_, log) => {
          const { label, color } = callLogStatusTag(log.status);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "provider",
        title: t("Nhà cung cấp"),
        width: 130,
        render: (_, log) => providerLabel(log.provider),
      },
    ],
    [],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <PeriodBar range={range} periods={["day", "week", "month"]} />
        <StaffFilter
          label={t("Nhân viên")}
          value={staffId}
          onChange={(next) => {
            setStaffId(next);
            pagination.resetToFirstPage();
          }}
        />
      </div>

      <DataTable<CallLogDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, pagerTotal)}
        locale={{ emptyText: t("Chưa có cuộc gọi") }}
      />
    </div>
  );
}
